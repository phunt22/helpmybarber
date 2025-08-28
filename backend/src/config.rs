use serde::Deserialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub model: String,
}

impl Config {
    /// Load configuration from the default config directory
    pub fn load_default() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let config_path = Path::new("config/prompts.toml");
        let contents = fs::read_to_string(config_path)?;
        let config: Config = toml::from_str(&contents)?;
        Ok(config)
    }
}