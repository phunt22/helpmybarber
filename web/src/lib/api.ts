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


export const fileToBase64 = async (file: File) => {
    const reader = new FileReader();
    return new Promise<string>((resolve, reject) => {
        reader.onload = () => {
            const result = reader.result as string;
            
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


export const compressImage = async(imageFile: File, targetSize: number = 1024 * 1024): Promise<File> => { 
    const img: HTMLImageElement = await loadImage(imageFile)

    const compressionNeeded = targetSize / imageFile.size;
    let quality = Math.min(0.8, compressionNeeded * 1.5)
    let scale = compressionNeeded < 0.5 ? Math.sqrt(compressionNeeded * 2) : 1
    const compress = (q: number, s: number) => new Promise<File>((resolve) => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('could not generate canvas context')
        
        canvas.width = (img).width * s
        canvas.height = (img).height * s
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
            if(!blob) throw new Error('could not generate blob from canvas')
            
            const file = new File([blob], imageFile.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
            });
            resolve(file)
        }, 'image/jpeg', q)
    });
    let result = await compress(quality, scale)

    // recursively compress
    while(result.size > targetSize && quality > 0.1) {
        quality *= 0.7
        result = await compress(quality, scale)
    }
    return result
}

function loadImage(file: File): Promise<HTMLImageElement>{
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file)
    })
}