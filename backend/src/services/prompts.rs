use serde::Deserialize;
use std::fs;

#[derive(Debug, Deserialize)]
struct PromptTemplate {
    template: String,
}

#[derive(Debug, Deserialize)]
struct PromptConfig {
    front_view: PromptTemplate,
    side_and_back_views: PromptTemplate,
}

pub struct Prompts {
    config: PromptConfig,
}

impl Prompts {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let config_content = fs::read_to_string("prompts.toml")?;
        let config: PromptConfig = toml::from_str(&config_content)?;
        Ok(Prompts { config })
    }

    pub fn front_view(&self, haircut_description: &str) -> String {
        self.config
            .front_view
            .template
            .replace("{haircut}", haircut_description)
    }

    pub fn side_and_back_views(&self, haircut_description: &str) -> String {
        self.config
            .side_and_back_views
            .template
            .replace("{haircut}", haircut_description)
    }
}
