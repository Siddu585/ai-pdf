import os
import cv2
from PIL import Image
import numpy as np
import tempfile
import uuid

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
    Uses unique temp directories to prevent race conditions in multi-core environments.
    """
    target_bytes = target_kb * 1024
    original_size = os.path.getsize(input_path)
    
    out_path = input_path + "_optimized.jpg"
    
    if original_size <= target_bytes:
        # Already good
        img = Image.open(input_path)
        img.convert('RGB').save(out_path, "JPEG", quality=95)
        return out_path

    img = Image.open(input_path)
    orig_w, orig_h = img.size

    # Creation of a unique workspace for this specific request
    with tempfile.TemporaryDirectory() as work_dir:
        # Intelligent bounds
        min_quality = 65  # Never go below 65 quality to avoid heavy artifacts
        
        # We will test multiple resolution scales to find the sharpest one that fits
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
                test_name = f"scale_{scale}_q_{mid}.jpg"
                temp_test_path = os.path.join(work_dir, test_name)
                
                temp_img.save(temp_test_path, "JPEG", quality=mid)
                size = os.path.getsize(temp_test_path)
                
                if size <= target_bytes:
                    best_qual_for_scale = mid
                    low = mid + 1 # Try pushing quality higher
                else:
                    high = mid - 1
                    
            # Evaluate Best found at this scale
            eval_path = os.path.join(work_dir, f"eval_{scale}.jpg")
            temp_img.save(eval_path, "JPEG", quality=best_qual_for_scale)
            eval_size = os.path.getsize(eval_path)
            
            if eval_size <= target_bytes:
                score = calculate_blur(eval_path)
                if score > best_blur_score:
                    best_blur_score = score
                    # Copy the new winner to a stable path outside the work_dir
                    # We reuse out_path as the final destination
                    if os.path.exists(out_path):
                        os.remove(out_path)
                    
                    # Manual copy instead of rename to ensure it survives work_dir deletion
                    import shutil
                    shutil.copyfile(eval_path, out_path)
                    found_valid = True
                    
        if not found_valid:
            # Extreme fallback: 200px aggressive
            temp_img = img.resize((200, int(200 * orig_h/orig_w)), Image.Resampling.LANCZOS).convert('RGB')
            temp_img.save(out_path, "JPEG", quality=50)

    # work_dir auto-cleans up everything inside it
    return out_path
