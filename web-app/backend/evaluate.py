"""Opt-in live regression examples, not semantic grading: python -m backend.evaluate."""

import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from .core import LEVELS, Survey, create_chain, load_knowledge, replace_story, check_factual_markers
from langchain_core.exceptions import OutputParserException

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
        dict(
            id="library_holdout",
            input={**BASE, "topics": ["독서"], "topic": "독서", "type": "묘사", "experience": "집에서 걸어서 10분 거리에 작은 도서관이 있다. 창문이 커서 안이 밝다. 주중 저녁마다 혼자 자격증 공부를 한다. 주말에는 그곳에 가지 않는다.", "clarifications": []},
            anchors=[("도보 거리", r"(?:10|ten)[- ]minutes?"),
                     ("큰 창문", r"(?:big|large) windows?|windows? (?:is|are) (?:big|large)"),
                     ("자격증 공부", r"qualif|certific|licen[cs]"),
                     ("주중 저녁", r"weekday.*evening|evening.*weekday"),
                     ("주말에는 가지 않음", r"(?:not|don't|never).*weekends?|weekends?.*(?:not|don't|never)")],
            forbidden=[("원문에 없는 분위기·집중·계획", r"\b(?:quiet|calm|concentrat\w*|focus\w*|no plans)\b")],
            outline_anchors=[("주말 부정", r"주말.*않|주말.*안")],
        ),
        dict(
            id="hotel_holdout",
            input={**BASE, "topics": ["해외 여행"], "topic": "해외 여행", "type": "롤플레이", "experience": "가상 상황이다. 호텔 직원에게 공항 셔틀이 있는지, 첫차가 몇 시인지, 내일 아침 7시에 예약할 수 있는지 물어보고 싶다.", "clarifications": []},
            anchors=[("공항 셔틀", r"airport shuttle|shuttle.*airport"), ("첫차 질문", r"first"),
                     ("예약", r"book|reserv"), ("내일", r"tomorrow"),
                     ("아침 7시", r"(?:7|seven)\s*(?:a\.?m\.?|in the morning)|morning.*(?:7|seven)")],
            outline_anchors=[("첫차", r"첫차|첫.*셔틀"), ("예약", r"예약")],
        ),
        dict(
            id="cafe_contrast",
            input={**BASE, "type": "묘사", "topics": ["카페 가기"], "topic": "카페 가기", "clarifications": [],
                   "experience": "회사 옆 카페는 크고 시끄럽다. 나는 화요일 저녁에 혼자 가서 따뜻한 차를 마신다. 커피는 마시지 않는다. 창가 자리가 몇 개인지는 모른다."},
            anchors=[("시끄러운 공간", r"noisy|loud"), ("화요일 저녁", r"Tuesday.*evening"),
                     ("따뜻한 차", r"(?:warm|hot) tea"), ("커피 부정", r"(?:not|don't).*coffee"),
                     ("모르는 좌석 수", r"(?:not|don't).*know.*(?:seat|chair)|(?:seat|chair).*unknown")],
            forbidden=[("추가된 독서·집중·이유", r"\b(?:read|focus|concentrat\w*|because I like)\b")],
            outline_anchors=[("화요일", r"화요일"), ("좌석 수 모름", r"모른|모름|알지 못")],
        ),
        dict(
            id="travel_contrast",
            input={**BASE, "topics": ["국내 여행"], "topic": "국내 여행", "clarifications": [],
                   "experience": "지난 일요일 혼자 버스를 타고 박물관에 갔다. 버스를 40분 탔다. 도착해서 표를 사려고 했지만 휴관일이라 안에 들어가지 못했다. 아쉬워서 바로 집에 돌아왔다. 날씨는 기억나지 않는다."},
            anchors=[("버스 이용", r"bus"), ("이동 40분", r"(?:40|forty)[- ]minutes?"),
                     ("입장하지 못함", r"(?:could not|couldn't|did not|didn't|unable).*?(?:enter|go in|get in)|prevented.*entering"),
                     ("날씨 기억 안남", r"(?:not|don't|can't|cannot).*remember.*weather|no memory.*weather")],
            forbidden=[("추가된 동행인", r"\bfriend\b")],
            outline_anchors=[("휴관", r"휴관|문.*닫"), ("날씨 기억 안남", r"날씨.*기억.*않|날씨.*기억.*안")],
        ),
    ]


def inspect_note(note, case):
    """Limited, example-specific markers: can miss errors and flag valid paraphrases."""
    issues = []
    for level in LEVELS:
        answer = note.variants.get(level)
        if not answer:
            issues.append(f"{level}: 비교 초안 없음")
            continue
        try:
            check_factual_markers(answer, Survey.model_validate(case["input"]).facts)
        except OutputParserException:
            issues.append(f"{level}: 원문에 없는 숫자값·부호·요일")
        for label, pattern in case["anchors"]:
            if not re.search(pattern, answer, re.I | re.S):
                issues.append(f"{level}: {label} 표현 확인 필요")
        for label, pattern in case.get("forbidden", []):
            if re.search(pattern, answer, re.I):
                issues.append(f"{level}: {label} 추가 여부 확인 필요")
        if case["input"]["type"] == "롤플레이" and "?" not in answer:
            issues.append(f"{level}: 상황 설명 대신 실제 질문인지 확인 필요")
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
