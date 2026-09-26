# say.mine — 웹 실행본

설문과 경험을 입력하면 개인화된 OPIc 말하기 연습 카드를 만듭니다.
Colab 노트북은 별도 실행하며 웹 서버에서 사용하지 않습니다.

## 준비

Python 3.12, Node.js 22.13 이상, [Ollama](https://ollama.com/download)가 필요합니다.
API 키는 필요 없으며 최초 모델 다운로드에 인터넷과 약 2.5GB의 저장 공간이 필요합니다.

Ollama 앱을 먼저 켜거나 별도 터미널에서 `ollama serve`를 실행하세요.
이후 프로젝트 폴더에서 실행합니다.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
npm ci
ollama pull qwen3:4b-instruct
```

Windows에서는 `py -3.12 -m venv .venv`로 만들고,
활성화 대신 `.\.venv\Scripts\python.exe`를 사용할 수 있습니다.

## 실행

Python 가상환경의 터미널:

```sh
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

별도 터미널:

```sh
npm run dev -- --hostname 127.0.0.1
```

브라우저에서 http://127.0.0.1:5173/ 를 엽니다. 기본값으로 실행할 때 .env는 필요 없습니다.

## 주요 파일

- app/page.tsx: 설문·경험 입력과 결과 화면
- app/api/: Python 백엔드로 요청 전달
- backend/main.py: 생성 API 서버
- backend/core.py: 입력 검증 → 프롬프트 → LLM → 결과 파싱
- backend/knowledge.md: 프롬프트에 넣는 학습 기준
- components/study-tools.tsx: 표현 비교·말하기 연습·정보 추가·정정
- lib/session.ts: JSON 검증·저장·복원 및 TXT 내보내기

실제 모델은 Ollama에서 실행합니다. 유효한 경험 입력이 25자 미만이면 LLM 호출 없이 미리 작성한 보완 질문을 반환합니다. 사용자가 경험을 추가해 다시 생성합니다.
표현 수준마다 문장 결합·어휘·수식 방식의 규칙을 다르게 적용합니다. 연습 유형에 맞는 3단계 비교 예시를 넣어 같은 경험의 영어 초안 세 개를 생성한 뒤, 선택한 수준의 초안으로 연습 카드를 만듭니다. 예시는 별도 상황이며 사용자 경험으로 복사하지 않도록 구분합니다.
유효한 긴 입력에는 기본적으로 LLM을 두 번 호출합니다. 선택한 초안에서 원문에 없는 숫자값·부호가 발견되거나 보조 카드의 형식·언어 검증에 실패하면, 각 단계에서 한 번만 수정 요청합니다. 최대로는 네 번 호출하며, 재검증에도 실패하면 오류를 반환합니다. 숫자 검사는 아라비아 숫자값만 비교하므로 영어로 쓴 수량, 단위, 감정 등 의미 전체를 검증하지는 못합니다.
검증된 영어 초안은 카드 단계에서 변경하지 않습니다. 한국어 연습 팁은 수준별로 미리 작성한 안내이며 나머지 카드 내용은 LLM이 생성합니다.
입력·결과는 자동 저장되지 않습니다. 파일 저장은 사용자가 직접 실행합니다. 공식 채점이나 등급 보장 기능은 아니며 결과의 사실 확인이 필요합니다.
인증 없는 로컬 학습용이므로 서버를 인터넷에 공개하지 마세요.

## 개발 검증

```sh
python -m unittest backend.test_core
npm test
npx tsc --noEmit
npm run build
```

학습 기준 참고: [국내 OPIc](https://www.opic.or.kr/opics/servlet/controller.opic.site.about.AboutServlet?p_process=move-introduce-opic) · [ACTFL](https://www.actfl.org/assessments/postsecondary-assessments/opi/tips-for-opi-and-opic-test-takers)

표현 지침 참고: [ACTFL 2024 Speaking](https://www.actfl.org/uploads/files/general/Resources-Publications/ACTFL_Proficiency_Guidelines_2024.pdf) · [British Council 접속사](https://learnenglishteens.britishcouncil.org/comment/74051) · [Cambridge 담화 표지](https://dictionary.cambridge.org/grammar/british-grammar/discourse-markers-so-right). 세 표현 수준과 예시는 자체 학습 설계이며 공식 등급별 모범 답안이 아닙니다.

## 비교하고 직접 말하기

- 결과의 ‘같은 이야기, 세 가지 표현 비교’에서 표현 수준별 초안을 비교합니다. 숫자 검사를 통과한 초안만 표시하며, 선택한 수준을 수정한 경우 수정본을 표시합니다. 비교해도 원래 노트의 표현·키워드는 바뀌지 않습니다.
- ‘말하기 연습 시작’에서 전체 답변 → 한국어 뼈대 → 영어 키워드 → 질문만 순서로 연습합니다. 타이머와 단계별 완료 표시는 연습 화면을 떠나면 초기화됩니다. 녹음·음성 인식은 사용하지 않습니다.
- 결과 아래의 보완 질문에 답하면 원문과 추가 답변으로 노트를 다시 생성합니다. 실패하면 기존 노트와 작성한 답변을 유지합니다. 질문은 사실이 아닌 문맥으로 전달하며 원문과 답변의 합계는 1,500자, 추가 답변은 최대 12개입니다. 원문을 수정하면 이전 추가 답변은 초기화됩니다.
- 시간·동행자 등 잘못된 사실은 ‘기존 내용 정정’에서 올바른 전체 이야기를 확인한 뒤 재생성합니다. 이전 원문·추가 답변은 새 컨텍스트에서 제외하며 성공 후에만 이전 기록으로 보관합니다. 정정에 실패하면 기존 노트와 작성 중인 내용을 유지합니다.
- 표현 점검은 수준 간 높은 유사도, 일부 분사 표현, 강도 표현을 알려주는 규칙 기반 안내입니다. 자동 교정·채점이 아니며 오탐과 누락이 있습니다. 추가 답변을 확정 사실로 명시해도 모델이 누락하거나 의미를 바꿀 수 있습니다.
- ‘읽기용 TXT’는 입력·비교 답변·검토 안내·이전 이야기 요약을 저장합니다. ‘이어하기용 JSON’은 현재 노트와 이전 노트 최대 10개를 저장합니다. 불러오기는 2MB 이내 버전 1 파일을 검사하고, 교체 확인 후에만 현재 화면에 반영합니다.
- 파일은 브라우저에서만 읽으며 서버·localStorage에 자동 보관하지 않습니다. 다시 생성을 누를 때 현재 설문·확정 사실만 로컬 모델에 전달합니다. 정정 전 이야기도 JSON에 남으므로 파일 공유 전에 확인하세요.
- 새로고침하면 화면 상태가 사라집니다. 미저장 결과·작성 중인 입력이 있으면 브라우저 이탈 경고를 요청합니다. 작성 중인 답변·정정문과 타이머는 파일에 저장되지 않습니다.
