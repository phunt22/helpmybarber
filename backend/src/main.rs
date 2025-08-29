use axum::{
    extract::Json,
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
        .layer(CorsLayer::permissive());
        .layer(DefaultBodyLimit::max(3 * 1024 * 1024)) // 3MB

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