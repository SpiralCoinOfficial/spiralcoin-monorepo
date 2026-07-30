import re

with open('spiralcoin_platform_embed.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove JS single-line comment-only lines
cleaned = [l for l in lines if not l.strip().startswith('//')]
content = ''.join(cleaned)

# Remove HTML comments
content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
# Remove CSS block comments  
content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
# Collapse newlines + surrounding whitespace to single space
content = re.sub(r'[ \t]*\n[ \t]*', ' ', content)
# Collapse multiple spaces
content = re.sub(r' {2,}', ' ', content).strip()

with open('spiralcoin_oneliner.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done. Lines:', content.count('\n'), 'Chars:', len(content))
