use crate::services::prompts::Prompts;
use base64::{engine::general_purpose, Engine as _};
use reqwest;
use serde::Serialize;
use std::error::Error;
use std::sync::Arc;
use tracing::{error, info};

#[derive(Debug, Serialize)]
pub struct ImageVariation {
    pub image: String,
    pub angle: String, // "front", "side", or "back"
}

const URL: &str = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent";

pub async fn generate_haircut_images(
    prompt: &str,
    image_data: &[u8],
    generate_angles: bool,
    prompts: &Arc<Prompts>,
) -> Result<Vec<ImageVariation>, Box<dyn Error + Send + Sync>> {
    let api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY environment variable not set")?;

    let base64_image = general_purpose::STANDARD.encode(image_data);

    info!(
        generate_angles,
        prompt_len = prompt.len(),
        "Calling Gemini generate_haircut_images"
    );

    if generate_angles {
        return generate_all_angles_together(prompt, &base64_image, &api_key, prompts).await;
    }

    // Generate front angle (default behavior)
    let generation_prompt = prompts.front_view(prompt);

    let request_body = serde_json::json!({
        "contents": [{
            "parts": [
                {
                    "text": generation_prompt
                },
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": base64_image
                    }
                }
            ]
        }]
    });

    let client = reqwest::Client::new();

    let response = client
        .post(URL)
        .header("x-goog-api-key", &api_key)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|err| format!("Failed to read error body: {}", err));
        error!(
            %status,
            body = %error_text,
            "Gemini API error during front-view generation"
        );
        return Err(format!("Gemini API error: {} - {}", status, error_text).into());
    }

    let response_text = response.text().await?;

    let gemini_response: serde_json::Value =
        serde_json::from_str(&response_text).map_err(|_| "JSON parse error")?;

    let mut variations = Vec::new();

    if let Some(candidates) = gemini_response.get("candidates").and_then(|c| c.as_array()) {
        for candidate in candidates.iter() {
            if let Some(parts) = candidate
                .get("content")
                .and_then(|c| c.get("parts"))
                .and_then(|p| p.as_array())
            {
                for part in parts.iter() {
                    if let Some(inline_data) = part.get("inlineData") {
                        if let (Some(mime_type), Some(data)) = (
                            inline_data.get("mimeType").and_then(|v| v.as_str()),
                            inline_data.get("data").and_then(|v| v.as_str()),
                        ) {
                            let data_url = format!("data:{};base64,{}", mime_type, data);
                            variations.push(ImageVariation {
                                image: data_url,
                                angle: "front".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    if variations.is_empty() {
        error!("Gemini returned zero images for front view");
        return Err("No images generated".into());
    }

    Ok(variations)
}

async fn generate_all_angles_together(
    prompt: &str,
    base64_image: &str,
    api_key: &str,
    prompts: &Arc<Prompts>,
) -> Result<Vec<ImageVariation>, Box<dyn Error + Send + Sync>> {
    let generation_prompt = prompts.side_and_back_views(prompt);

    let request_body = serde_json::json!({
        "contents": [{
            "parts": [
                {"text": generation_prompt},
                {"inline_data": {
                    "mime_type": "image/jpeg",
                    "data": base64_image
                }}
            ]
        }]
    });

    let client = reqwest::Client::new();
    let response = client
        .post(URL)
        .header("x-goog-api-key", api_key)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|err| format!("Failed to read error body: {}", err));
        error!(
            %status,
            body = %error_text,
            "Gemini API error during angle generation"
        );
        return Err(format!("Gemini API error: {} - {}", status, error_text).into());
    }

    let response_text = response.text().await?;
    let gemini_response: serde_json::Value =
        serde_json::from_str(&response_text).map_err(|_| "JSON parse error")?;

    let mut all_variations = Vec::new();

    if let Some(candidates) = gemini_response.get("candidates").and_then(|c| c.as_array()) {
        // Only process the first candidate to avoid duplicates
        if let Some(candidate) = candidates.first() {
            if let Some(parts) = candidate
                .get("content")
                .and_then(|c| c.get("parts"))
                .and_then(|p| p.as_array())
            {
                // Collect all images from all parts
                let mut image_count = 0;
                for part in parts.iter() {
                    if let Some(inline_data) = part.get("inlineData") {
                        if let (Some(mime_type), Some(data)) = (
                            inline_data.get("mimeType").and_then(|v| v.as_str()),
                            inline_data.get("data").and_then(|v| v.as_str()),
                        ) {
                            let angle = match image_count {
                                0 => "side",
                                1 => "back",
                                _ => continue, // Skip any additional images beyond 2
                            };

                            let data_url = format!("data:{};base64,{}", mime_type, data);
                            all_variations.push(ImageVariation {
                                image: data_url,
                                angle: angle.to_string(),
                            });
                            image_count += 1;

                            if image_count >= 2 {
                                // only proces first 2, in case unexpected behavior
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    if all_variations.is_empty() {
        error!("Gemini returned zero images for side/back views");
        return Err("No angle images generated".into());
    }

    Ok(all_variations)
}
