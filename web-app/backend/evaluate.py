"""Opt-in live regression examples, not semantic grading: python -m backend.evaluate."""

import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from .core import LEVELS, Survey, create_chain, load_knowledge, replace_story

BASE = dict(
    work="일 경험 없음", student="학생", home="가족과 거주", target="IM2",
    level=LEVELS[0], topics=["공원 가기"], topic="공원 가기", type="경험 이야기",
    experience="지난 토요일 친구와 집 근처 공원에 갔다. 공원 안에서 30분 동안 걸었다. 걷다가 비가 와서 바로 집에 돌아왔다. 친구와 이야기할 수 있어서 즐거웠다.",
    clarifications=[dict(question="귀가 후에는 무엇을 했나요?", answer="집에 돌아온 뒤 젖은 옷을 갈아입었다.")],
)


def evaluation_cases():
    corrected = replace_story(BASE, Survey.model_validate(BASE).facts.replace("30분", "20분"))
    clothes = r"(?:chang\w*.*clothes|put on.*clothes)"
    return [
        dict(id="addition", input=BASE, anchors=[("산책 시간", r"(?:30|thirty)\s+minutes"), ("추가한 옷 갈아입기", clothes)], outline_anchors=[("옷 갈아입기", r"옷.*갈아|갈아.*옷")]),
        dict(id="correction", input=corrected, anchors=[("정정된 산책 시간", r"(?:20|twenty)\s+minutes"), ("옷 갈아입기", clothes)], outline_anchors=[("정정된 시간", r"20분"), ("옷 갈아입기", r"옷.*갈아|갈아.*옷")]),
        dict(id="description", input={**BASE, "topics": ["카페 가기"], "topic": "카페 가기", "type": "묘사", "experience": "집 근처 카페는 작고 조용하다. 창문 옆에 자리가 세 개 있다. 나는 주말마다 그곳에서 책을 읽는다. 조용해서 집중하기 좋다.", "clarifications": []}, anchors=[("창가 좌석 수", r"(?:three|3)\s+seats"), ("주말 독서", r"read\w*.*(?:weekend|weekends)|(?:weekend|weekends).*read")], outline_anchors=[("독서", r"책|독서")]),
        dict(id="roleplay", input={**BASE, "topics": ["카페 가기"], "topic": "카페 가기", "type": "롤플레이", "experience": "가상 상황이다. 카페 직원에게 테이크아웃이 가능한지, 디카페인 커피가 있는지, 가격이 얼마인지 물어보고 싶다.", "clarifications": []}, anchors=[("테이크아웃", r"take.?out|take.?away|to go"), ("디카페인", r"decaf"), ("가격 질문", r"how much|price|cost")], outline_anchors=[("가격", r"가격|얼마")]),
    ]


def inspect_note(note, case):
    """Limited, example-specific markers: can miss errors and flag valid paraphrases."""
    issues = []
    for level in LEVELS:
        answer = note.variants.get(level)
        if not answer:
            issues.append(f"{level}: 비교 초안 없음")
            continue
        for label, pattern in case["anchors"]:
            if not re.search(pattern, answer, re.I | re.S):
                issues.append(f"{level}: {label} 표현 확인 필요")
    outline = " ".join(note.outline)
    for label, pattern in case["outline_anchors"]:
        if not re.search(pattern, outline):
            issues.append(f"한국어 뼈대: {label} 확인 필요")
    return issues


def run_cases(chain, cases):
    results = []
    for case in cases:
        started = time.monotonic()
        row = {"id": case["id"], "input": case["input"]}
        try:
            note = chain.invoke(case["input"])
            row.update(note=note.model_dump(), checks=inspect_note(note, case))
            print(f"{case['id']}: 생성 완료 · 사실 표현 점검 {len(row['checks'])}개 · 표현 안내 {len(note.quality_warnings)}개", flush=True)
        except Exception as error:
            row["error"] = type(error).__name__
            print(f"{case['id']}: 생성 실패 · {row['error']}", flush=True)
        row["seconds"] = round(time.monotonic() - started, 2)
        results.append(row)
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Optional JSON report, including example inputs and outputs")
    args = parser.parse_args()
    if args.output and (args.output.exists() or not args.output.parent.is_dir()):
        parser.error("Choose a new report file in an existing directory; reports are not overwritten.")
    chain = create_chain(load_knowledge(Path(__file__).with_name("knowledge.md")))
    report = dict(created_at=datetime.now(timezone.utc).isoformat(),
                  caveat="예제별 표현 패턴 검사이며 사실성·문법·OPIc 등급을 판정하지 않습니다. 오탐과 누락이 있습니다.",
                  results=run_cases(chain, evaluation_cases()))
    if args.output:
        # Refuse to overwrite an existing report.
        with args.output.open("x", encoding="utf-8") as output:
            json.dump(report, output, ensure_ascii=False, indent=2)
    if any("error" in row for row in report["results"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
