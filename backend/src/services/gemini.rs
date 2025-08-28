use std::error::Error;
use reqwest;
use base64::{Engine as _, engine::general_purpose};

// Request structures are built dynamically, no need for static structs

// Structs not needed - we parse JSON directly for maximum flexibility

pub async fn generate_haircut_images(
    prompt: &str,
    image_data: &[u8],
) -> Result<Vec<String>, Box<dyn Error + Send + Sync>> {
    let api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY environment variable not set")?;

    let base64_image = general_purpose::STANDARD.encode(image_data);

    // Generate actual image using Gemini's image generation capabilities
    let generation_prompt = format!(
        "Create a photorealistic portrait image of this exact person with a {} haircut. \
         Generate a new image showing the same person with the new hairstyle applied naturally. \
         Keep all facial features, skin tone, expression, and overall appearance identical - only change the hair.",
        prompt
    );

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
    let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent";

    let response = client
        .post(url)
        .header("x-goog-api-key", &api_key)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        eprintln!("Gemini API error ({}): {}", status, error_text.chars().take(100).collect::<String>());
        return Err("API error".into());
    }

    let response_text = response.text().await?;

    let gemini_response: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|_| "JSON parse error")?;

    let mut images = Vec::new();

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
                            inline_data.get("data").and_then(|v| v.as_str())
                        ) {
                            let data_url = format!("data:{};base64,{}", mime_type, data);
                            images.push(data_url);
                        }
                    }
                }
            }
        }
    }

    if images.is_empty() {
        eprintln!("No images generated");
        return Err("No images generated".into());
    }

    Ok(images)
}

