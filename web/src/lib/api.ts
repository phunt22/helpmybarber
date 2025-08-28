export interface GenerateHaircutsRequest {
    prompt: string;
    imageData: string;
}

export interface GenerateHaircutsResponse {
    success: boolean;
    variations: string[];
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
                throw new Error(`HTTP error! status: ${response.status}`);
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


export const fileToBase64 = async (file: File) => {
    const reader = new FileReader();
    return new Promise<string>((resolve, reject) => {
        reader.onload = () => {
            const result = reader.result as string;
            // Extract base64 data from data URL format
            // Format: "data:image/jpeg;base64,/9j/..."
            if (result.startsWith('data:')) {
                const base64Data = result.split(',')[1];
                resolve(base64Data);
            } else {
                resolve(result);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}