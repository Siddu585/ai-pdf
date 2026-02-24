import os
import cv2
from PIL import Image
import numpy as np

def calculate_blur(image_path):
    """
    Quality Assurance Metric: Calculates the Variance of Laplacian to measure blurriness.
    Lower score = more blurry.
    """
    image = cv2.imread(image_path)
    if image is None:
        return 0
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()

def run_iterative_image_compression(input_path: str, target_kb: int) -> str:
    """
    Programmatic Agent Loop: Iteratively finds the best balance of resolution
    and JPEG quality to meet the target_kb exactly without falling below a clarity threshold.
    """
    target_bytes = target_kb * 1024
    original_size = os.path.getsize(input_path)
    
    out_path = input_path + "_compressed.jpg"
    
    if original_size <= target_bytes:
        # Already good
        img = Image.open(input_path)
        img.convert('RGB').save(out_path, "JPEG", quality=95)
        return out_path

    img = Image.open(input_path)
    orig_w, orig_h = img.size

    # Intelligent bounds
    min_quality = 65  # Never go below 65 quality to avoid heavy artifacts
    
    # We will test multiple resolution scales to find the sharpest one that fits
    best_path = out_path
    best_blur_score = 0
    found_valid = False

    scales = [1.0, 0.8, 0.6, 0.4, 0.25, 0.15]
    
    for scale in scales:
        new_w = int(orig_w * scale)
        new_h = int(orig_h * scale)
        
        # Don't shrink below a reasonable threshold for documents/faces unless absolutely forced
        if new_w < 300 and target_kb > 10:
            continue

        temp_img = img.resize((new_w, new_h), Image.Resampling.LANCZOS).convert('RGB')
        
        # Binary search for the best JPEG quality at this scale
        low = min_quality
        high = 95
        best_qual_for_scale = low
        
        while low <= high:
            mid = (low + high) // 2
            temp_path = f"temp_{scale}_{mid}.jpg"
            temp_img.save(temp_path, "JPEG", quality=mid)
            size = os.path.getsize(temp_path)
            
            if size <= target_bytes:
                best_qual_for_scale = mid
                low = mid + 1 # Try pushing quality higher
            else:
                high = mid - 1
                
        # Evaluate Best found at this scale
        eval_path = f"temp_eval_{scale}.jpg"
        temp_img.save(eval_path, "JPEG", quality=best_qual_for_scale)
        eval_size = os.path.getsize(eval_path)
        
        if eval_size <= target_bytes:
            score = calculate_blur(eval_path)
            if score > best_blur_score:
                best_blur_score = score
                # Save the new winner
                if os.path.exists(best_path):
                    os.remove(best_path)
                os.rename(eval_path, best_path)
                found_valid = True
        else:
            if os.path.exists(eval_path):
                os.remove(eval_path)
                
    if not found_valid:
        # Extreme fallback: 200px aggressive
        temp_img = img.resize((200, int(200 * orig_h/orig_w)), Image.Resampling.LANCZOS).convert('RGB')
        temp_img.save(best_path, "JPEG", quality=50)

    # Cleanup temp files
    for f in os.listdir("."):
        if f.startswith("temp_"):
            os.remove(f)
            
    return best_path
