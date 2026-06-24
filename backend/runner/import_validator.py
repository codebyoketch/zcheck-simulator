"""
Import validator — checks submitted code for illegal imports
BEFORE sending to Docker. Fast, cheap, language-aware.
"""
import re
from typing import List, Tuple


def validate_go_imports(code: str, forbidden: List[str], allowed: List[str]) -> Tuple[bool, str]:
    # Match both single imports and import blocks
    single_import = re.findall(r'import\s+"([^"]+)"', code)
    block_imports = re.findall(r'import\s*\(([^)]+)\)', code, re.DOTALL)

    found_imports = set(single_import)
    for block in block_imports:
        pkgs = re.findall(r'"([^"]+)"', block)
        found_imports.update(pkgs)

    def matches(imp: str, pkg: str) -> bool:
        """Match full path or suffix: 'z01' matches 'github.com/01-edu/z01'"""
        return imp == pkg or imp.endswith('/' + pkg)

    for imp in found_imports:
        for forbidden_pkg in forbidden:
            if matches(imp, forbidden_pkg):
                return False, (
                    f'❌ Illegal import detected: "{imp}" is not allowed for this exercise.\n'
                    f'   Hint: Use the allowed packages instead.'
                )

    if allowed:
        for imp in found_imports:
            if not any(matches(imp, a) for a in allowed):
                return False, (
                    f'❌ Import "{imp}" is not in the allowed imports for this exercise.\n'
                    f'   Allowed: {", ".join(allowed)}'
                )

    return True, ''


def validate_python_imports(code: str, forbidden: List[str], allowed: List[str]) -> Tuple[bool, str]:
    """Check Python import statements."""
    import_lines = re.findall(
        r'^\s*(?:import|from)\s+([\w.]+)', code, re.MULTILINE
    )

    for imp in import_lines:
        root = imp.split('.')[0]
        if root in forbidden or imp in forbidden:
            return False, f'❌ Illegal import: "{imp}" is not allowed for this exercise.'

    return True, ''


def validate_js_imports(code: str, forbidden: List[str], allowed: List[str]) -> Tuple[bool, str]:
    """Check JavaScript require/import statements."""
    requires = re.findall(r'require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)', code)
    es_imports = re.findall(r'import\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]', code)

    found = set(requires + es_imports)
    for imp in found:
        if imp in forbidden:
            return False, f'❌ Illegal import: "{imp}" is not allowed for this exercise.'

    return True, ''


VALIDATORS = {
    'go': validate_go_imports,
    'python': validate_python_imports,
    'javascript': validate_js_imports,
}


def validate_imports(language_slug: str, code: str, forbidden: List[str], allowed: List[str]) -> Tuple[bool, str]:
    validator = VALIDATORS.get(language_slug)
    if not validator:
        return True, ''  # Unknown language — let runner handle it
    return validator(code, forbidden, allowed)
