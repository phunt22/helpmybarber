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

// Simple error message utility
const getErrorMessage = (error: unknown, response?: Response): string => {
    if (response) {
        if (response.status === 429) {
            return "Too many requests. Please wait a minute before trying again.";
        }
        if (response.status >= 500) {
            return "Server error. Please try again.";
        }
    }

    if (error instanceof TypeError) {
        return "Connection failed. Please check your internet and try again.";
    }

    return "Something went wrong. Please try again.";
};

export const ApiService = {
    generateHaircuts: async (request: GenerateHaircutsRequest): Promise<GenerateHaircutsResponse> => {
        try {
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

            const response = await fetch(`${API_BASE}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(getErrorMessage(null, response));
            }

            const data: GenerateHaircutsResponse = await response.json();

            if (!data.success && data.message) {
                return {
                    success: false,
                    variations: [],
                    message: data.message,
                };
            }

            return data;
        } catch (error) {
            return {
                success: false,
                variations: [],
                message: getErrorMessage(error, undefined),
            };
        }
    },
}

