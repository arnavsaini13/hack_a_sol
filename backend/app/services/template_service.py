"""
Template renderer service for locked templates with number slots.
Pure formatting using Jinja2 with strict slot filling.
"""
from pathlib import Path
from typing import Any
from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_template(template_path: str, context: dict[str, Any]) -> str:
    """Render a locked Jinja2 template."""
    tmpl = env.get_template(template_path)
    return tmpl.render(**context)


class TemplateService:
    """Service for rendering locked bilingual templates."""

    def __init__(self, templates_dir: Path | None = None) -> None:
        self.dir = templates_dir or TEMPLATES_DIR
        self.env = Environment(
            loader=FileSystemLoader(self.dir),
            autoescape=select_autoescape(["html", "xml"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def render(self, template_path: str, context: dict[str, Any]) -> str:
        tmpl = self.env.get_template(template_path)
        return tmpl.render(**context)

    def render_grievance_letter(self, context: dict[str, Any], language: str = "hi") -> str:
        lang = "hi" if language.lower().startswith("hi") else "en"
        template_name = f"grievance/letter_{lang}.html"
        return self.render(template_name, context)

