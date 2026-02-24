import base64
import os
from groq import Groq
from dotenv import load_dotenv
from PIL import Image
import io

load_dotenv()

def extract_text_from_image(image_path: str) -> str:
    """
    OCR Agent: Extracts text from an image using Groq Vision AI (Llama 3.2 11b Vision).
    This bypasses the need for local Tesseract binaries.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "Error: GROQ_API_KEY not found in backend .env file."

    try:
        client = Groq(api_key=api_key)
        
        # Standardize and compress the image to prevent token/payload limits or mime errors
        img = Image.open(image_path)
        if img.mode != "RGB":
            img = img.convert("RGB")
            
        # Constraint for massive images to prevent 'invalid image data' due to API limits
        img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG", quality=70)
        encoded_string = base64.b64encode(buffered.getvalue()).decode('utf-8')
            
        chat_completion = client.chat.completions.create(
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract all text from this image exactly as written. Output exclusively the transcribed text and absolutely no conversational filler or intro."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded_string}"}}
                ]
            }],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.1
        )
        return chat_completion.choices[0].message.content
        
    except Exception as e:
        print(f"Vision OCR Error: {e}")
        return f"Error: Could not extract text via AI Vision. ({e})"
