export interface GenerateHaircutsRequest {
    prompt: string;
    imageData: string;
    generateAngles?: boolean;
}

export interface ImageVariation {
    image: string;
    angle: string;
}

export interface GenerateHaircutsResponse {
    success: boolean;
    variations: ImageVariation[];
    message?: string;
}

export const ApiService = {
    generateHaircuts: async (request: GenerateHaircutsRequest): Promise<GenerateHaircutsResponse> => {
        try {
            const response = await fetch('http://localhost:3001/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} message: ${response.statusText}`);
            }

            const data: GenerateHaircutsResponse = await response.json();
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            return {
                success: false,
                variations: [],
                message: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    },
}

