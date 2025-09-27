from __future__ import annotations
from typing import List, Tuple
import numpy as np
from .parsers import ParsedEmail

FEATURE_COLUMNS = [
    "spf_pass","spf_fail","spf_softfail","spf_neutral","spf_none",
    "dkim_pass","dkim_fail","dkim_neutral","dkim_none",
    "dmarc_pass","dmarc_fail","dmarc_bestguesspass","dmarc_none",
    "received_count","reply_to_mismatch","display_vs_addr_distance","has_punycode",
    "url_count","short_url_count",
    "att_count","att_any_archive","att_any_macro_like","att_total_size_kb",
    "grammar_error_count","perplexity_score",
]

SHORTENER_HOSTS = {"bit.ly","t.co","tinyurl.com","goo.gl"}

def _onehot(value: str, choices: List[str]) -> List[int]:
    return [1 if value == c else 0 for c in choices]

def _domain(host: str) -> str:
    host = host.lower().strip()
    return host.split("/")[2] if "//" in host else host.split("/")[0]

def build_feature_vector(p: ParsedEmail) -> Tuple[np.ndarray, List[str]]:
    spf_vec = _onehot(p.spf, ["pass","fail","softfail","neutral","none"])
    dkim_vec = _onehot(p.dkim, ["pass","fail","neutral","none"])
    dmarc_vec = _onehot(p.dmarc, ["pass","fail","bestguesspass","none"])

    url_count = len(p.urls)
    short_count = 0
    for u in p.urls:
        try:
            h = _domain(u)
            if any(s in h for s in SHORTENER_HOSTS):
                short_count += 1
        except Exception:
            continue

    att_count = len(p.attachments_meta)
    any_archive = int(any(a.get("archive_like") for a in p.attachments_meta))
    any_macro = int(any(a.get("suspicious_macro") for a in p.attachments_meta))
    total_kb = int(sum(a.get("size_bytes", 0) for a in p.attachments_meta) / 1024)

    grammar = int(p.grammar_error_count or 0)
    ppl = float(p.perplexity_score or 0.0)

    vec = [
        *spf_vec,*dkim_vec,*dmarc_vec,
        int(p.received_count), int(p.reply_to_mismatch), int(p.display_vs_addr_distance), int(p.has_punycode),
        int(url_count), int(short_count),
        int(att_count), any_archive, any_macro, int(total_kb),
        grammar, ppl,
    ]
    return np.asarray(vec, dtype=np.float32), FEATURE_COLUMNS

