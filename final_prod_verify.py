import os
import sys

# Add the backend/app directory to the path so we can import pdf_agent
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.pdf_agent import run_iterative_pdf_compression

def final_verify():
    input_file = r"c:\Users\Siddhant\Desktop\Building A DOC utility website\Quantitative Aptitude for Competitive Examinations.pdf"
    
    # Test at 10% (Should be ~7MB)
    print("Testing at 10% slider (Extreme)...")
    out10 = run_iterative_pdf_compression(input_file, 10)
    size10 = os.path.getsize(out10) / 1024 / 1024
    print(f"10% Size: {size10:.2f} MB")
    
    # Test at 20% (Should be ~11MB)
    print("\nTesting at 20% slider (Target)...")
    out20 = run_iterative_pdf_compression(input_file, 20)
    size20 = os.path.getsize(out20) / 1024 / 1024
    print(f"20% Size: {size20:.2f} MB")

    print("\n--- FINAL VERIFICATION COMPLETE ---")

if __name__ == "__main__":
    final_verify()
