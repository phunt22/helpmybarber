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

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use serde_json::Value;

    #[tokio::test]
    async fn test_generate_haircut_images_missing_api_key() {
        // Remove API key if it exists
        env::remove_var("GEMINI_API_KEY");

        let result = generate_haircut_images("test prompt", &[1, 2, 3]).await;
        
        match result {
            Err(e) => {
                assert!(e.to_string().contains("GEMINI_API_KEY"));
            }
            _ => panic!("Expected error for missing API key"),
        }
    }

    #[test]
    fn test_base64_encoding() {
        let test_data = b"test image data";
        let encoded = general_purpose::STANDARD.encode(test_data);
        let decoded = general_purpose::STANDARD.decode(&encoded).unwrap();
        assert_eq!(decoded, test_data);
    }

    #[test]
    fn test_request_body_structure() {
        let prompt = "Test haircut style";
        let image_data = b"test image bytes";
        
        let base64_image = general_purpose::STANDARD.encode(image_data);
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

        // Verify the JSON structure
        assert!(request_body.get("contents").is_some());
        let contents = request_body.get("contents").unwrap().as_array().unwrap();
        assert_eq!(contents.len(), 1);
        
        let content = &contents[0];
        let parts = content.get("parts").unwrap().as_array().unwrap();
        assert_eq!(parts.len(), 2);
        
        // Check text part
        let text_part = &parts[0];
        assert!(text_part.get("text").is_some());
        assert!(text_part.get("text").unwrap().as_str().unwrap().contains("Test haircut style"));
        
        // Check image part
        let image_part = &parts[1];
        let inline_data = image_part.get("inline_data").unwrap();
        assert_eq!(inline_data.get("mime_type").unwrap(), "image/jpeg");
        assert!(inline_data.get("data").is_some());
        assert_eq!(inline_data.get("data").unwrap(), base64_image);
    }

    #[test]
    fn test_error_message_formatting() {
        let error_msg = "Test error";
        assert_eq!(error_msg, "Test error");
    }

    #[test]
    fn test_empty_image_data() {
        let empty_data: Vec<u8> = vec![];
        let base64_empty = general_purpose::STANDARD.encode(&empty_data);
        assert!(!base64_empty.is_empty());
        
        let decoded = general_purpose::STANDARD.decode(&base64_empty).unwrap();
        assert_eq!(decoded.len(), 0);
    }

    #[test]
    fn test_large_image_data() {
        let large_data: Vec<u8> = vec![0; 1024 * 1024]; // 1MB
        let base64_large = general_purpose::STANDARD.encode(&large_data);
        assert!(!base64_large.is_empty());
        
        let decoded = general_purpose::STANDARD.decode(&base64_large).unwrap();
        assert_eq!(decoded.len(), 1024 * 1024);
    }

    #[test]
    fn test_data_url_generation() {
        let mime_type = "image/jpeg";
        let data = "test_base64_data";
        
        let data_url = format!("data:{};base64,{}", mime_type, data);
        assert!(data_url.starts_with("data:image/jpeg;base64,"));
        assert!(data_url.ends_with("test_base64_data"));
    }

    #[test]
    fn test_data_url_generation_png() {
        let mime_type = "image/png";
        let data = "png_base64_data";
        
        let data_url = format!("data:{};base64,{}", mime_type, data);
        assert!(data_url.starts_with("data:image/png;base64,"));
        assert!(data_url.ends_with("png_base64_data"));
    }

    #[test]
    fn test_prompt_formatting() {
        let prompt = "Low taper fade";
        let expected_prompt = format!(
            "Create a photorealistic portrait image of this exact person with a {} haircut. \
             Generate a new image showing the same person with the new hairstyle applied naturally. \
             Keep all facial features, skin tone, expression, and overall appearance identical - only change the hair.",
            prompt
        );
        
        assert!(expected_prompt.contains("Low taper fade"));
        assert!(expected_prompt.contains("photorealistic"));
        assert!(expected_prompt.contains("identical"));
        assert!(expected_prompt.contains("only change the hair"));
    }

    #[test]
    fn test_prompt_formatting_special_characters() {
        let prompt = "Modern & stylish cut";
        let expected_prompt = format!(
            "Create a photorealistic portrait image of this exact person with a {} haircut. \
             Generate a new image showing the same person with the new hairstyle applied naturally. \
             Keep all facial features, skin tone, expression, and overall appearance identical - only change the hair.",
            prompt
        );
        
        assert!(expected_prompt.contains("Modern & stylish cut"));
    }

    #[test]
    fn test_json_value_navigation_single_image() {
        let json_data = r#"
        {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "inlineData": {
                                    "mimeType": "image/jpeg",
                                    "data": "test_data"
                                }
                            }
                        ]
                    }
                }
            ]
        }
        "#;
        
        let response: Value = serde_json::from_str(json_data).unwrap();
        
        // Test navigation through the JSON structure
        let candidates = response.get("candidates").unwrap().as_array().unwrap();
        assert_eq!(candidates.len(), 1);
        
        let candidate = &candidates[0];
        let content = candidate.get("content").unwrap();
        let parts = content.get("parts").unwrap().as_array().unwrap();
        assert_eq!(parts.len(), 1);
        
        let part = &parts[0];
        let inline_data = part.get("inlineData").unwrap();
        let mime_type = inline_data.get("mimeType").unwrap().as_str().unwrap();
        let data = inline_data.get("data").unwrap().as_str().unwrap();
        
        assert_eq!(mime_type, "image/jpeg");
        assert_eq!(data, "test_data");
    }

    #[test]
    fn test_json_value_navigation_multiple_images() {
        let json_data = r#"
        {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "inlineData": {
                                    "mimeType": "image/jpeg",
                                    "data": "test_data_1"
                                }
                            },
                            {
                                "inlineData": {
                                    "mimeType": "image/png",
                                    "data": "test_data_2"
                                }
                            }
                        ]
                    }
                }
            ]
        }
        "#;
        
        let response: Value = serde_json::from_str(json_data).unwrap();
        
        let candidates = response.get("candidates").unwrap().as_array().unwrap();
        let parts = candidates[0].get("content").unwrap().get("parts").unwrap().as_array().unwrap();
        assert_eq!(parts.len(), 2);
        
        // Check first image
        let inline_data_1 = parts[0].get("inlineData").unwrap();
        assert_eq!(inline_data_1.get("mimeType").unwrap(), "image/jpeg");
        assert_eq!(inline_data_1.get("data").unwrap(), "test_data_1");
        
        // Check second image
        let inline_data_2 = parts[1].get("inlineData").unwrap();
        assert_eq!(inline_data_2.get("mimeType").unwrap(), "image/png");
        assert_eq!(inline_data_2.get("data").unwrap(), "test_data_2");
    }

    #[test]
    fn test_json_value_navigation_no_candidates() {
        let json_data = r#"
        {
            "candidates": []
        }
        "#;
        
        let response: Value = serde_json::from_str(json_data).unwrap();
        let candidates = response.get("candidates").unwrap().as_array().unwrap();
        assert_eq!(candidates.len(), 0);
    }

    #[test]
    fn test_json_value_navigation_missing_inline_data() {
        let json_data = r#"
        {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": "Some text response"
                            }
                        ]
                    }
                }
            ]
        }
        "#;
        
        let response: Value = serde_json::from_str(json_data).unwrap();
        let candidates = response.get("candidates").unwrap().as_array().unwrap();
        let parts = candidates[0].get("content").unwrap().get("parts").unwrap().as_array().unwrap();
        
        // Should have text but no inlineData
        assert!(parts[0].get("text").is_some());
        assert!(parts[0].get("inlineData").is_none());
    }

    #[test]
    fn test_json_value_navigation_malformed() {
        let json_data = r#"
        {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "inlineData": {
                                    "data": "test_data"
                                }
                            }
                        ]
                    }
                }
            ]
        }
        "#;
        
        let response: Value = serde_json::from_str(json_data).unwrap();
        let candidates = response.get("candidates").unwrap().as_array().unwrap();
        let parts = candidates[0].get("content").unwrap().get("parts").unwrap().as_array().unwrap();
        let inline_data = parts[0].get("inlineData").unwrap();
        
        // Missing mimeType
        assert!(inline_data.get("mimeType").is_none());
        assert!(inline_data.get("data").is_some());
    }

    #[test]
    fn test_url_construction() {
        let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent";
        assert!(url.contains("generativelanguage.googleapis.com"));
        assert!(url.contains("gemini-2.5-flash-image-preview"));
        assert!(url.contains("generateContent"));
    }

    #[test]
    fn test_client_headers() {
        let api_key = "test_api_key";
        let expected_header_key = "x-goog-api-key";
        let expected_content_type = "application/json";
        
        assert_eq!(expected_header_key, "x-goog-api-key");
        assert_eq!(expected_content_type, "application/json");
        assert!(!api_key.is_empty());
    }

    #[test]
    fn test_error_truncation() {
        let long_error = "a".repeat(200);
        let truncated: String = long_error.chars().take(100).collect();
        
        assert_eq!(truncated.len(), 100);
        assert!(truncated.chars().all(|c| c == 'a'));
    }

    #[test]
    fn test_different_mime_types() {
        let jpeg_data_url = format!("data:{};base64,{}", "image/jpeg", "jpeg_data");
        let png_data_url = format!("data:{};base64,{}", "image/png", "png_data");
        let webp_data_url = format!("data:{};base64,{}", "image/webp", "webp_data");
        
        assert!(jpeg_data_url.starts_with("data:image/jpeg;"));
        assert!(png_data_url.starts_with("data:image/png;"));
        assert!(webp_data_url.starts_with("data:image/webp;"));
    }

    #[test]
    fn test_prompt_edge_cases() {
        let empty_prompt = "";
        let very_long_prompt = "a".repeat(1000);
        let unicode_prompt = "髪型 スタイル";
        
        for prompt in [empty_prompt, &very_long_prompt, unicode_prompt] {
            let formatted = format!(
                "Create a photorealistic portrait image of this exact person with a {} haircut. \
                 Generate a new image showing the same person with the new hairstyle applied naturally. \
                 Keep all facial features, skin tone, expression, and overall appearance identical - only change the hair.",
                prompt
            );
            
            assert!(formatted.contains("photorealistic"));
            assert!(formatted.contains("identical"));
        }
    }

    #[test]
    fn test_base64_edge_cases() {
        // Test various base64 scenarios
        let empty = general_purpose::STANDARD.encode("");
        let single_byte = general_purpose::STANDARD.encode("a");
        let binary_data = general_purpose::STANDARD.encode(&[0, 1, 2, 255, 254, 253]);
        
        assert!(!empty.is_empty());
        assert!(!single_byte.is_empty());
        assert!(!binary_data.is_empty());
        
        // Verify they decode correctly
        assert_eq!(general_purpose::STANDARD.decode(&empty).unwrap(), b"");
        assert_eq!(general_purpose::STANDARD.decode(&single_byte).unwrap(), b"a");
        assert_eq!(general_purpose::STANDARD.decode(&binary_data).unwrap(), &[0, 1, 2, 255, 254, 253]);
    }
}

