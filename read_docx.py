import docx
doc = docx.Document(r'c:\Users\Siddhant\Desktop\Building A DOC utility website\Prompt 001.docx')
for p in doc.paragraphs:
    print(p.text)
