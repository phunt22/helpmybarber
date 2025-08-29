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
use services::gemini::ImageVariation;
use services::prompts::Prompts;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    // Load environment variables from .env file
    dotenv::dotenv().ok();

    let prompts = Arc::new(Prompts::load().expect("Failed to load prompts.toml"));

    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .route("/health", get(health_check))
        .route("/api/generate", post({
            let prompts_clone = Arc::clone(&prompts);
            move |body| generate_haircut_image(body, prompts_clone)
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

async fn health_check() -> &'static str {
    "OK"
}


async fn generate_haircut_image(
    Json(request): Json<GenerateRequest>,
    prompts: Arc<Prompts>,
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

    let image_variations = match services::gemini::generate_haircut_images(
        &request.prompt,
        &image_data,
        request.generate_angles,
        &prompts,
    ).await {
        Ok(variations) => variations,
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
        variations: image_variations,
        message: None,
    }))
}