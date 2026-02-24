from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
import fitz # PyMuPDF
import os
from dotenv import load_dotenv

load_dotenv()

def extract_text_from_pdf(pdf_path: str) -> str:
    text = ""
    try:
        doc = fitz.open(pdf_path)
        # Extract first 10 pages to avoid massive token limits
        for i in range(min(10, len(doc))):
            text += doc[i].get_text() + "\n"
        doc.close()
    except Exception as e:
        print(f"PDF Parsing Error: {e}")
    return text

def chat_with_pdf(pdf_path: str, user_query: str) -> str:
    """
    Chat Agent: Extracts text from PDF and sends it to Groq API to answer the user's query.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "Error: GROQ_API_KEY not found in backend .env file."
        
    pdf_text = extract_text_from_pdf(pdf_path)
    
    if not pdf_text.strip():
        return "Could not extract readable text from this PDF. It might be scanned pages (requires OCR)."

    try:
        # Initialize Groq Llama3 8B model natively
        chat = ChatGroq(
            temperature=0.1, 
            groq_api_key=api_key, 
            model_name="llama-3.3-70b-versatile"
        )
        
        messages = [
            SystemMessage(content=(
                "You are an intelligent PDF assistant. Use the provided EXCERPT from the PDF "
                "to answer the user's question directly and concisely.\n\n"
                f"--- PDF EXCERPT ---\n{pdf_text[:15000]}\n--- END EXCERPT ---"
            )),
            HumanMessage(content=user_query),
        ]
        
        response = chat.invoke(messages)
        return response.content
        
    except Exception as e:
        print(f"Groq API Error: {e}")
        return f"Error communicating with AI: {str(e)}"
