use axum::{
    extract::{Json, DefaultBodyLimit},
    http::StatusCode,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;
use std::net::SocketAddr;
use base64::{Engine as _, engine::general_purpose};

mod services;

#[tokio::main]
async fn main() {
    // Load environment variables from .env file
    dotenv::dotenv().ok();

    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .route("/health", get(health_check))
        .route("/api/generate", post({
            move |body| generate_haircut_image(body)
        }))
        .layer(DefaultBodyLimit::max(3 * 1024 * 1024)) // 3MB, output images generally are 2MB
        .layer(CorsLayer::permissive());

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse::<u16>()
        .unwrap_or(3001);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
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

#[derive(Debug, Serialize)]
struct GenerateResponse {
    success: bool,
    variations: Vec<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GenerateRequest {
    prompt: String,
    #[serde(rename = "imageData")]
    image_data: String, // base64 encoded
}

async fn health_check() -> &'static str {
    "OK"
}


async fn generate_haircut_image(
    Json(request): Json<GenerateRequest>,
) -> Result<Json<GenerateResponse>, (StatusCode, Json<GenerateResponse>)> {
    let image_data = match general_purpose::STANDARD.decode(&request.image_data) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("Invalid image data: {}", e);
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

    let image_urls = match services::gemini::generate_haircut_images(
        &request.prompt,
        &image_data,
    ).await {
        Ok(urls) => urls,
        Err(error) => {
            eprintln!("Gemini API error: {}", error);
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
        variations: image_urls,
        message: None,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;
    use serde_json::json;
    use axum_test::TestServer;

    #[tokio::test]
    async fn test_health_check() {
        let response = health_check().await;
        assert_eq!(response, "OK");
    }

    #[tokio::test]
    async fn test_health_endpoint() {
        let app = Router::new().route("/health", get(health_check));
        let server = TestServer::new(app).unwrap();
        
        let response = server.get("/health").await;
        
        assert_eq!(response.status_code(), StatusCode::OK);
        assert_eq!(response.text(), "OK");
    }

    #[tokio::test]
    async fn test_root_endpoint() {
        let app = Router::new().route("/", get(|| async { "Hello, World!" }));
        let server = TestServer::new(app).unwrap();
        
        let response = server.get("/").await;
        
        assert_eq!(response.status_code(), StatusCode::OK);
        assert_eq!(response.text(), "Hello, World!");
    }

    #[tokio::test]
    async fn test_generate_haircut_image_invalid_base64() {
        let request = GenerateRequest {
            prompt: "Test haircut".to_string(),
            image_data: "invalid base64!".to_string(),
        };

        let json_request = Json(request);
        let result = generate_haircut_image(json_request).await;

        match result {
            Err((status, response)) => {
                assert_eq!(status, StatusCode::BAD_REQUEST);
                let response_body = response.0;
                assert!(!response_body.success);
                assert_eq!(response_body.variations.len(), 0);
                assert_eq!(response_body.message, Some("Invalid image data".to_string()));
            }
            _ => panic!("Expected error response"),
        }
    }

    #[tokio::test]
    async fn test_generate_haircut_image_valid_base64() {
        // Set up environment for testing
        std::env::set_var("GEMINI_API_KEY", "test_key");
        
        let valid_base64 = general_purpose::STANDARD.encode("test image data");
        let request = GenerateRequest {
            prompt: "Test haircut".to_string(),
            image_data: valid_base64,
        };

        let json_request = Json(request);
        
        // This will fail because we don't have a real API key and server
        // But it tests that the base64 decoding works
        let result = generate_haircut_image(json_request).await;
        
        match result {
            Err((status, response)) => {
                // Should fail at the API call stage, not base64 decoding
                assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
                let response_body = response.0;
                assert!(!response_body.success);
                assert_eq!(response_body.message, Some("Failed to generate images".to_string()));
            }
            Ok(_) => {
                // If somehow the API call succeeds (shouldn't in test environment)
                // that's also fine for this test
            }
        }
    }

    #[tokio::test]
    async fn test_generate_response_serialization() {
        let response = GenerateResponse {
            success: true,
            variations: vec!["data:image/jpeg;base64,test".to_string()],
            message: None,
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"variations\""));
        assert!(json.contains("data:image/jpeg;base64,test"));
    }

    #[tokio::test]
    async fn test_generate_request_deserialization() {
        let json = r#"{
            "prompt": "Test haircut",
            "imageData": "base64data"
        }"#;

        let request: GenerateRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.prompt, "Test haircut");
        assert_eq!(request.image_data, "base64data");
    }

    #[tokio::test]
    async fn test_generate_request_deserialization_missing_fields() {
        let json = r#"{"prompt": "Test haircut"}"#;
        
        let result: Result<GenerateRequest, _> = serde_json::from_str(json);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_port_configuration_default() {
        std::env::remove_var("PORT");
        
        let port = std::env::var("PORT")
            .unwrap_or_else(|_| "3001".to_string())
            .parse::<u16>()
            .unwrap_or(3001);
        
        assert_eq!(port, 3001);
    }

    #[tokio::test]
    async fn test_port_configuration_custom() {
        std::env::set_var("PORT", "8080");
        
        let port = std::env::var("PORT")
            .unwrap_or_else(|_| "3001".to_string())
            .parse::<u16>()
            .unwrap_or(3001);
        
        assert_eq!(port, 8080);
        
        // Clean up
        std::env::remove_var("PORT");
    }

    #[tokio::test]
    async fn test_port_configuration_invalid() {
        std::env::set_var("PORT", "invalid");
        
        let port = std::env::var("PORT")
            .unwrap_or_else(|_| "3001".to_string())
            .parse::<u16>()
            .unwrap_or(3001);
        
        assert_eq!(port, 3001); // Should fall back to default
        
        // Clean up
        std::env::remove_var("PORT");
    }

    #[tokio::test]
    async fn test_socket_addr_creation() {
        let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
        assert_eq!(addr.ip().to_string(), "127.0.0.1");
        assert_eq!(addr.port(), 3001);
    }

    #[tokio::test]
    async fn test_base64_encoding_decoding() {
        let test_data = b"test image data";
        let encoded = general_purpose::STANDARD.encode(test_data);
        let decoded = general_purpose::STANDARD.decode(&encoded).unwrap();
        assert_eq!(decoded, test_data);
    }

    #[tokio::test]
    async fn test_empty_variations_response() {
        let response = GenerateResponse {
            success: false,
            variations: vec![],
            message: Some("No images generated".to_string()),
        };

        assert!(!response.success);
        assert!(response.variations.is_empty());
        assert!(response.message.is_some());
    }

    #[tokio::test]
    async fn test_multiple_variations_response() {
        let response = GenerateResponse {
            success: true,
            variations: vec![
                "data:image/jpeg;base64,image1".to_string(),
                "data:image/jpeg;base64,image2".to_string(),
            ],
            message: None,
        };

        assert!(response.success);
        assert_eq!(response.variations.len(), 2);
        assert!(response.message.is_none());
    }

    #[tokio::test]
    async fn test_cors_layer_integration() {
        let app = Router::new()
            .route("/test", get(|| async { "test" }))
            .layer(CorsLayer::permissive());
        
        let server = TestServer::new(app).unwrap();
        let response = server.get("/test").await;
        
        assert_eq!(response.status_code(), StatusCode::OK);
        assert_eq!(response.text(), "test");
    }

    #[tokio::test]
    async fn test_json_extraction() {
        let app = Router::new().route(
            "/test",
            post(|Json(payload): Json<GenerateRequest>| async move {
                Json(GenerateResponse {
                    success: true,
                    variations: vec![format!("Received: {}", payload.prompt)],
                    message: None,
                })
            }),
        );

        let server = TestServer::new(app).unwrap();
        
        let response = server
            .post("/test")
            .json(&json!({
                "prompt": "test prompt",
                "imageData": "dGVzdA=="
            }))
            .await;

        assert_eq!(response.status_code(), StatusCode::OK);
        
        let body: GenerateResponse = response.json();
        assert!(body.success);
        assert_eq!(body.variations[0], "Received: test prompt");
    }

    #[tokio::test]
    async fn test_invalid_json_request() {
        let app = Router::new().route("/test", post(generate_haircut_image));
        let server = TestServer::new(app).unwrap();
        
        let response = server
            .post("/test")
            .text("invalid json")
            .await;
        
        // Should get a bad request due to invalid JSON
        assert_eq!(response.status_code(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_generate_response_debug() {
        let response = GenerateResponse {
            success: true,
            variations: vec!["test".to_string()],
            message: Some("debug test".to_string()),
        };

        let debug_str = format!("{:?}", response);
        assert!(debug_str.contains("success: true"));
        assert!(debug_str.contains("test"));
        assert!(debug_str.contains("debug test"));
    }

    #[test]
    fn test_generate_request_debug() {
        let request = GenerateRequest {
            prompt: "debug test".to_string(),
            image_data: "base64".to_string(),
        };

        let debug_str = format!("{:?}", request);
        assert!(debug_str.contains("debug test"));
        assert!(debug_str.contains("base64"));
    }
}