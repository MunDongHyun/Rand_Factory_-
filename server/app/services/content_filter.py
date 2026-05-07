import re


SENSITIVE_PATTERNS = [
    ("전화번호", re.compile(r"\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b")),
    ("이메일 주소", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    ("주민등록번호", re.compile(r"\b\d{6}[-\s]?[1-4]\d{6}\b")),
]


def check_sensitive_content(text: str) -> tuple[bool, str | None]:
    detected = [name for name, pattern in SENSITIVE_PATTERNS if pattern.search(text)]
    if not detected:
        return False, None
    return True, ", ".join(detected)
