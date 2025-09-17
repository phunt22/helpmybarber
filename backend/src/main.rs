use axum::{
    extract::{Json, DefaultBodyLimit, ConnectInfo},
    http::StatusCode,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;
use std::net::SocketAddr;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use base64::{Engine as _, engine::general_purpose};

// Simple in-memory rate limiter
type RateLimitStore = Mutex<HashMap<String, Vec<u64>>>;

fn get_rate_limit_key(ip: &std::net::IpAddr) -> String {
    format!("{}", ip)
}

fn check_rate_limit(store: &RateLimitStore, ip: &std::net::IpAddr) -> bool {
    let key = get_rate_limit_key(ip);
    let mut store = store.lock().unwrap();
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

    // Clean up old entries (older than 60 seconds)
    let entries = store.entry(key.clone()).or_insert_with(Vec::new);
    entries.retain(|&timestamp| now - timestamp < 60);

    // Check if under limit (10 requests per minute)
    if entries.len() >= 10 {
        return false;
    }

    // Add current request
    entries.push(now);
    true
}

// Input validation functions
fn validate_image_data(data: &str) -> Result<(), String> {
    // Check if it's valid base64
    if let Err(_) = general_purpose::STANDARD.decode(data) {
        return Err("Invalid image data format".to_string());
    }

    // Check size (max 10MB when decoded)
    let decoded_size = (data.len() * 3) / 4;
    if decoded_size > 10 * 1024 * 1024 {
        return Err("Image too large (max 10MB)".to_string());
    }

    Ok(())
}

fn validate_prompt(prompt: &str) -> Result<(), String> {
    // Check length
    if prompt.trim().is_empty() {
        return Err("Prompt cannot be empty".to_string());
    }

    if prompt.len() > 500 {
        return Err("Prompt too long (max 500 characters)".to_string());
    }

    // Basic content filtering - reject obviously malicious prompts
    let lower_prompt = prompt.to_lowercase();
    let blocked_words = ["script", "javascript", "html", "css", "<", ">", "http", "www"];

    for word in blocked_words {
        if lower_prompt.contains(word) {
            return Err("Prompt contains invalid content".to_string());
        }
    }

    Ok(())
}

mod services;
use services::gemini::ImageVariation;
use services::prompts::Prompts;
use std::sync::Arc;

#[derive(Debug, Serialize)]
struct GenerateResponse {
    success: bool,
    variations: Vec<ImageVariation>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GenerateRequest {
    prompt: String,
    #[serde(rename = "imageData")]
    image_data: String, // base64 encoded
    #[serde(rename = "generateAngles", default)]
    generate_angles: bool,
}

#[tokio::main]
async fn main() {
    // Load environment variables from .env file
    dotenv::dotenv().ok();

    let prompts = Arc::new(Prompts::load().expect("Failed to load prompts.toml"));
    let rate_limit_store = Arc::new(RateLimitStore::new(HashMap::new()));

    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .route("/health", get(health_check))
        .route("/api/generate", post({
            let prompts_clone = Arc::clone(&prompts);
            let rate_limit_clone = Arc::clone(&rate_limit_store);
            move |ConnectInfo(addr): ConnectInfo<SocketAddr>, body: Json<GenerateRequest>| async move {
                // Check rate limit
                if !check_rate_limit(&rate_limit_clone, &addr.ip()) {
                    return Err((
                        StatusCode::TOO_MANY_REQUESTS,
                        Json(GenerateResponse {
                            success: false,
                            variations: vec![],
                            message: Some("Rate limit exceeded. Please wait a minute before trying again.".to_string()),
                        }),
                    ));
                }

                generate_haircut_image(body, prompts_clone).await
            }
        }))
        .layer(DefaultBodyLimit::max(3 * 1024 * 1024)) // 3MB, output images generally are 2MB
        .layer(CorsLayer::permissive());

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse::<u16>()
        .unwrap_or(3001);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Server running on http://{}", addr);

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(e) => {
            eprintln!("Bind error: {}", e);
            return;
        }
    };

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Server error: {}", e);
    }
}

async fn health_check() -> &'static str {
    "OK"
}

async fn generate_haircut_image(
    Json(request): Json<GenerateRequest>,
    prompts: Arc<Prompts>,
) -> Result<Json<GenerateResponse>, (StatusCode, Json<GenerateResponse>)> {
    // Validate inputs
    if let Err(msg) = validate_image_data(&request.image_data) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(GenerateResponse {
                success: false,
                variations: vec![],
                message: Some(msg),
            }),
        ));
    }

    if let Err(msg) = validate_prompt(&request.prompt) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(GenerateResponse {
                success: false,
                variations: vec![],
                message: Some(msg),
            }),
        ));
    }

    let image_data = match general_purpose::STANDARD.decode(&request.image_data) {
        Ok(data) => data,
        Err(_) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(GenerateResponse {
                    success: false,
                    variations: vec![],
                    message: Some("Invalid image data".to_string()),
                }),
            ));
        }
    };

    let image_variations = match services::gemini::generate_haircut_images(
        &request.prompt,
        &image_data,
        request.generate_angles,
        &prompts,
    ).await {
        Ok(variations) => variations,
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GenerateResponse {
                    success: false,
                    variations: vec![],
                    message: Some("Failed to generate images".to_string()),
                }),
            ));
        }
    };

    Ok(Json(GenerateResponse {
        success: true,
        variations: image_variations,
        message: None,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::IpAddr;
    use std::str::FromStr;

    // Helper function to create a test IP
    fn test_ip() -> IpAddr {
        IpAddr::from_str("127.0.0.1").unwrap()
    }

    // Helper function to create valid base64 data
    fn create_valid_base64(size_kb: usize) -> String {
        let data = vec![65u8; size_kb * 1024]; // 'A' repeated
        general_purpose::STANDARD.encode(&data)
    }

    // Helper function to create invalid base64 data
    fn create_invalid_base64() -> String {
        "invalid-base64-data!@#$%".to_string()
    }

    // ===== RATE LIMITING TESTS =====

    #[test]
    fn test_rate_limit_under_limit() {
        let store = RateLimitStore::new(HashMap::new());
        let ip = test_ip();

        // Should allow first 10 requests
        for _ in 0..10 {
            assert!(check_rate_limit(&store, &ip));
        }
    }

    #[test]
    fn test_rate_limit_over_limit() {
        let store = RateLimitStore::new(HashMap::new());
        let ip = test_ip();

        // Make 10 requests (should all pass)
        for _ in 0..10 {
            assert!(check_rate_limit(&store, &ip));
        }

        // 11th request should be blocked
        assert!(!check_rate_limit(&store, &ip));
    }

    #[test]
    fn test_rate_limit_different_ips() {
        let store = RateLimitStore::new(HashMap::new());
        let ip1 = IpAddr::from_str("127.0.0.1").unwrap();
        let ip2 = IpAddr::from_str("127.0.0.2").unwrap();

        // Make 10 requests with IP1 (should all pass)
        for _ in 0..10 {
            assert!(check_rate_limit(&store, &ip1));
        }

        // IP1 should now be blocked
        assert!(!check_rate_limit(&store, &ip1));

        // IP2 should still be able to make requests
        for _ in 0..10 {
            assert!(check_rate_limit(&store, &ip2));
        }

        // Now IP2 should also be blocked
        assert!(!check_rate_limit(&store, &ip2));
    }

    #[test]
    fn test_rate_limit_cleanup() {
        let store = RateLimitStore::new(HashMap::new());
        let ip = test_ip();

        // Simulate old timestamps (61 seconds ago)
        {
            let mut store_lock = store.lock().unwrap();
            let old_timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() - 61;
            store_lock.insert(get_rate_limit_key(&ip), vec![old_timestamp; 10]);
        }

        // Should allow new requests since old ones are cleaned up
        assert!(check_rate_limit(&store, &ip));
    }

    // ===== IMAGE VALIDATION TESTS =====

    #[test]
    fn test_validate_image_data_valid() {
        let valid_base64 = create_valid_base64(100); // 100KB
        assert!(validate_image_data(&valid_base64).is_ok());
    }

    #[test]
    fn test_validate_image_data_invalid_base64() {
        let invalid_base64 = create_invalid_base64();
        assert!(validate_image_data(&invalid_base64).is_err());
        assert_eq!(validate_image_data(&invalid_base64).unwrap_err(), "Invalid image data format");
    }

    #[test]
    fn test_validate_image_data_too_large() {
        let large_base64 = create_valid_base64(10240); // ~10MB (should fail)
        assert!(validate_image_data(&large_base64).is_err());
        assert_eq!(validate_image_data(&large_base64).unwrap_err(), "Image too large (max 10MB)");
    }

    #[test]
    fn test_validate_image_data_boundary_size() {
        let boundary_base64 = create_valid_base64(8192); // ~8MB (should pass)
        assert!(validate_image_data(&boundary_base64).is_ok());
    }

    // ===== PROMPT VALIDATION TESTS =====

    #[test]
    fn test_validate_prompt_valid() {
        let valid_prompt = "Low taper fade with textured top";
        assert!(validate_prompt(valid_prompt).is_ok());
    }

    #[test]
    fn test_validate_prompt_empty() {
        let empty_prompt = "";
        assert!(validate_prompt(empty_prompt).is_err());
        assert_eq!(validate_prompt(empty_prompt).unwrap_err(), "Prompt cannot be empty");
    }

    #[test]
    fn test_validate_prompt_whitespace_only() {
        let whitespace_prompt = "   \n\t   ";
        assert!(validate_prompt(whitespace_prompt).is_err());
        assert_eq!(validate_prompt(whitespace_prompt).unwrap_err(), "Prompt cannot be empty");
    }

    #[test]
    fn test_validate_prompt_too_long() {
        let long_prompt = "a".repeat(501);
        assert!(validate_prompt(&long_prompt).is_err());
        assert_eq!(validate_prompt(&long_prompt).unwrap_err(), "Prompt too long (max 500 characters)");
    }

    #[test]
    fn test_validate_prompt_boundary_length() {
        let boundary_prompt = "a".repeat(500);
        assert!(validate_prompt(&boundary_prompt).is_ok());
    }

    #[test]
    fn test_validate_prompt_blocked_words() {
        let blocked_prompts = vec![
            "I want a <script> haircut",
            "javascript injection attempt",
            "HTML styling please",
            "CSS changes needed",
            "Visit http://evil.com",
            "Check www.malicious.com",
        ];

        for prompt in blocked_prompts {
            assert!(validate_prompt(prompt).is_err(), "Prompt '{}' should be blocked", prompt);
            assert_eq!(validate_prompt(prompt).unwrap_err(), "Prompt contains invalid content");
        }
    }

    #[test]
    fn test_validate_prompt_case_insensitive() {
        let mixed_case_prompt = "I want a JaVaScRiPt haircut";
        assert!(validate_prompt(mixed_case_prompt).is_err());
        assert_eq!(validate_prompt(mixed_case_prompt).unwrap_err(), "Prompt contains invalid content");
    }

    #[test]
    fn test_validate_prompt_allowed_content() {
        let allowed_prompts = vec![
            "Low taper fade with textured top",
            "Classic crew cut, very short",
            "Pompadour with volume on top",
            "French crop with longer fringe",
            "Caesar cut with textured sides",
        ];

        for prompt in allowed_prompts {
            assert!(validate_prompt(prompt).is_ok(), "Prompt '{}' should be allowed", prompt);
        }
    }

    // ===== INTEGRATION TESTS =====

    #[test]
    fn test_rate_limit_integration() {
        let store = RateLimitStore::new(HashMap::new());
        let ip = test_ip();

        // Simulate rapid requests
        for i in 0..15 {
            let allowed = check_rate_limit(&store, &ip);
            if i < 10 {
                assert!(allowed, "Request {} should be allowed", i + 1);
            } else {
                assert!(!allowed, "Request {} should be blocked", i + 1);
            }
        }
    }

    #[test]
    fn test_get_rate_limit_key() {
        let ipv4 = IpAddr::from_str("192.168.1.1").unwrap();
        let ipv6 = IpAddr::from_str("::1").unwrap();

        assert_eq!(get_rate_limit_key(&ipv4), "192.168.1.1");
        assert_eq!(get_rate_limit_key(&ipv6), "::1");
    }
}