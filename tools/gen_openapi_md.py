#!/usr/bin/env python3
"""Render the TerminusDB OpenAPI spec as a markdown reference.

Usage: gen_openapi_md.py openapi.yaml out.md
Every operation, parameter, request body, response, and component schema in
the spec is rendered; nothing is summarized away except deep schema nesting
(depth > MAX_DEPTH) and very long examples (> MAX_EXAMPLE characters).
"""
import datetime
import json
import sys

import yaml

SRC_URL = "https://raw.githubusercontent.com/terminusdb/terminusdb/main/docs/openapi.yaml"
METHODS = ["get", "post", "put", "patch", "delete", "head", "options"]
MAX_DEPTH = 4
MAX_EXAMPLE = 1800

spec = yaml.safe_load(open(sys.argv[1]))
comp = spec.get("components", {})


def resolve(node):
    """Follow a local $ref; returns (name_or_None, resolved_node)."""
    if isinstance(node, dict) and "$ref" in node:
        ref = node["$ref"]
        cur = spec
        for part in ref.lstrip("#/").split("/"):
            cur = cur[part]
        return ref.split("/")[-1], cur
    return None, node


def clean(text):
    if text is None:
        return ""
    return " ".join(str(text).split())


def type_of(s):
    if not isinstance(s, dict):
        return ""
    name, s = resolve(s)
    if name:
        return f"`{name}`"
    if "oneOf" in s:
        return " or ".join(type_of(x) or "object" for x in s["oneOf"])
    if "anyOf" in s:
        return " or ".join(type_of(x) or "object" for x in s["anyOf"])
    if "allOf" in s:
        return " and ".join(type_of(x) or "object" for x in s["allOf"])
    t = s.get("type", "")
    if t == "array":
        return f"array of {type_of(s.get('items', {})) or 'any'}"
    if "enum" in s:
        t = f"{t or 'value'} enum: " + ", ".join(f"`{e}`" for e in s["enum"])
    if s.get("format"):
        t += f" ({s['format']})"
    if "default" in s:
        t += f", default `{s['default']}`"
    return t or ("object" if "properties" in s else "")


def render_schema(s, depth=0, indent=0):
    """Bullet-list rendering of a schema's properties."""
    lines = []
    pad = "  " * indent
    name, r = resolve(s)
    if name and depth > 0:
        return lines  # named component: described once in the schemas section
    if not isinstance(r, dict):
        return lines
    if depth > MAX_DEPTH:
        lines.append(f"{pad}- (nesting truncated)")
        return lines
    for key in ("oneOf", "anyOf", "allOf"):
        if key in r:
            for i, sub in enumerate(r[key], 1):
                lines.append(f"{pad}- {key} option {i}: {type_of(sub) or 'object'}")
                lines += render_schema(sub, depth + 1, indent + 1)
    required = set(r.get("required", []))
    for pname, p in (r.get("properties") or {}).items():
        _, pr = resolve(p)
        desc = clean(pr.get("description")) if isinstance(pr, dict) else ""
        req = " (required)" if pname in required else ""
        lines.append(f"{pad}- `{pname}`{req}: {type_of(p)}" + (f". {desc}" if desc else ""))
        if isinstance(pr, dict) and (pr.get("properties") or pr.get("items") or any(k in pr for k in ("oneOf", "anyOf", "allOf"))):
            sub = pr.get("items", pr) if pr.get("type") == "array" else pr
            lines += render_schema(sub, depth + 1, indent + 1)
    ap = r.get("additionalProperties")
    if isinstance(ap, dict):
        lines.append(f"{pad}- additional properties: {type_of(ap) or 'object'}")
    if r.get("type") == "array" and not r.get("properties") and depth == 0:
        lines.append(f"{pad}- items: {type_of(r.get('items', {})) or 'any'}")
    return lines


def render_example(ex):
    _, ex = resolve(ex)
    if isinstance(ex, dict) and "value" in ex:
        ex = ex["value"]
    try:
        text = json.dumps(ex, indent=2, ensure_ascii=False, default=str)
    except Exception:
        text = str(ex)
    if len(text) > MAX_EXAMPLE:
        text = text[:MAX_EXAMPLE] + "\n... (truncated)"
    return ["```json", text, "```"]


def render_content(content):
    lines = []
    for ctype, body in (content or {}).items():
        schema = body.get("schema", {})
        name, r = resolve(schema)
        head = f"- Content type `{ctype}`"
        if name:
            head += f": schema `{name}`"
        elif isinstance(r, dict) and r.get("type"):
            head += f": {type_of(r)}"
        lines.append(head)
        d = clean(r.get("description")) if isinstance(r, dict) else ""
        if d:
            lines.append(f"  - {d}")
        for l in render_schema(schema, 0, 1):
            lines.append(l)
        exs = []
        if "example" in body:
            exs.append(body["example"])
        for k, v in (body.get("examples") or {}).items():
            exs.append(v)
        for ex in exs[:3]:
            lines.append("")
            lines += ["  " + l for l in render_example(ex)]
    return lines


def slug(method, path):
    return f"{method}-{path}".lower().replace("/", "-").replace("{", "").replace("}", "").strip("-")


def js_note(op):
    v = op.get("x-js-client")
    return "" if v is None else str(v)


def py_note(op):
    v = op.get("x-python-client")
    return "" if v is None else str(v)


# ---- gather operations, grouped by first tag
ops = []
for path, item in spec["paths"].items():
    shared_params = item.get("parameters", [])
    for m in METHODS:
        if m in item:
            ops.append((path, m, item[m], shared_params))

by_tag = {}
for path, m, op, sp in ops:
    tag = (op.get("tags") or ["Untagged"])[0]
    by_tag.setdefault(tag, []).append((path, m, op, sp))
tag_order = [t["name"] for t in spec.get("tags", [])] + [t for t in by_tag if t not in [x["name"] for x in spec.get("tags", [])]]
tag_desc = {t["name"]: clean(t.get("description")) for t in spec.get("tags", [])}

info = spec["info"]
out = []
w = out.append
w(f"# {info['title']} reference (OpenAPI {spec.get('openapi')}, spec version {info['version']})")
w("")
w("> Generated from the OpenAPI spec, which is not published as a markdown page: the docs site's")
w("> `openapi` page is a React viewer over the YAML.")
w(f"> Source: {SRC_URL}")
w(f"> Generated: {datetime.date.today().isoformat()}. Regenerate whenever the docs are updated.")
w("> The `version` label in the spec (12.0.5) is the spec's own label and may lag the server release.")
w("")
w(clean(info.get("description")))
w("")
w("## How to read this reference")
w("")
w("- Base URL in the spec: " + ", ".join(f"`{s['url']}`" for s in spec.get("servers", [])) + ". Paths below are relative to it.")
sec = comp.get("securitySchemes", {})
if sec:
    w("- Authentication: " + "; ".join(f"`{k}` ({v.get('type')}{'/' + v['scheme'] if v.get('scheme') else ''})" for k, v in sec.items()) + ".")
w("- `JS client` and `Python client` come from the spec's `x-js-client` and `x-python-client` extensions. They name the SDK method that wraps the endpoint, or say `not_implemented`. **Where the JS client says `not_implemented`, the endpoint must be called over plain HTTP.**")
w("- A response shown with no schema means the spec gives none.")
w("")

w("## Endpoint index")
w("")
for tag in tag_order:
    if tag not in by_tag:
        continue
    w(f"### {tag}")
    if tag_desc.get(tag):
        w("")
        w(tag_desc[tag])
    w("")
    w("| Method | Path | operationId | Summary | JS client | Python client |")
    w("| --- | --- | --- | --- | --- | --- |")
    for path, m, op, sp in by_tag[tag]:
        w(f"| {m.upper()} | `{path}` | {op.get('operationId', '')} | {clean(op.get('summary'))} | {js_note(op)} | {py_note(op)} |")
    w("")

w("## Operations")
w("")
count = 0
for tag in tag_order:
    if tag not in by_tag:
        continue
    w(f"### {tag} operations")
    w("")
    for path, m, op, sp in by_tag[tag]:
        count += 1
        w(f"#### {m.upper()} {path}")
        w("")
        if op.get("operationId"):
            w(f"- operationId: `{op['operationId']}`")
        w(f"- Summary: {clean(op.get('summary'))}")
        if js_note(op) or py_note(op):
            w(f"- JS client: {js_note(op) or 'n/a'}")
            w(f"- Python client: {py_note(op) or 'n/a'}")
        if op.get("deprecated"):
            w("- **Deprecated**")
        w("")
        if op.get("description"):
            w(str(op["description"]).strip())
            w("")
        params = []
        for p in list(sp) + list(op.get("parameters", [])):
            _, pr = resolve(p)
            params.append(pr)
        if params:
            w("Parameters:")
            w("")
            w("| Name | In | Required | Type | Description |")
            w("| --- | --- | --- | --- | --- |")
            for p in params:
                w(f"| `{p.get('name')}` | {p.get('in')} | {'yes' if p.get('required') else 'no'} | {type_of(p.get('schema', {}))} | {clean(p.get('description')).replace('|', '/')} |")
            w("")
        rb = op.get("requestBody")
        if rb:
            _, rb = resolve(rb)
            w(f"Request body{' (required)' if rb.get('required') else ''}:")
            if rb.get("description"):
                w("")
                w(clean(rb["description"]))
            w("")
            for l in render_content(rb.get("content")):
                w(l)
            w("")
        w("Responses:")
        w("")
        for code, resp in (op.get("responses") or {}).items():
            _, r = resolve(resp)
            w(f"- **{code}**: {clean(r.get('description'))}")
            for l in render_content(r.get("content")):
                w("  " + l if l else l)
        w("")

if comp.get("schemas"):
    w("## Component schemas")
    w("")
    for name, s in comp["schemas"].items():
        w(f"### {name}")
        w("")
        if isinstance(s, dict) and s.get("description"):
            w(clean(s["description"]))
            w("")
        w(f"Type: {type_of(s) or 'object'}")
        w("")
        for l in render_schema(s, 0, 0):
            w(l)
        if isinstance(s, dict) and "example" in s:
            w("")
            for l in render_example(s["example"]):
                w(l)
        w("")

if comp.get("parameters"):
    w("## Shared parameters")
    w("")
    w("| Name | In | Required | Type | Description |")
    w("| --- | --- | --- | --- | --- |")
    for key, p in comp["parameters"].items():
        w(f"| `{p.get('name')}` ({key}) | {p.get('in')} | {'yes' if p.get('required') else 'no'} | {type_of(p.get('schema', {}))} | {clean(p.get('description')).replace('|', '/')} |")
    w("")

open(sys.argv[2], "w").write("\n".join(out) + "\n")
print(f"operations rendered: {count} of {len(ops)}; lines: {len(out)}")
