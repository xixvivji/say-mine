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

실제 모델은 Ollama에서 실행합니다. 유효한 경험 입력이 25자 미만이면 LLM 호출 없이 미리 작성한 보완 질문을 반환합니다. 사용자가 경험을 추가해 다시 생성합니다.
표현 수준마다 문장 결합·어휘·수식 방식의 규칙을 다르게 적용합니다. 연습 유형에 맞는 3단계 비교 예시를 넣어 같은 경험의 영어 초안 세 개를 생성한 뒤, 선택한 수준의 초안으로 연습 카드를 만듭니다. 예시는 별도 상황이며 사용자 경험으로 복사하지 않도록 구분합니다.
유효한 긴 입력에는 기본적으로 LLM을 두 번 호출합니다. 선택한 초안에서 원문에 없는 숫자값·부호가 발견되거나 보조 카드의 형식·언어 검증에 실패하면, 각 단계에서 한 번만 수정 요청합니다. 최대로는 네 번 호출하며, 재검증에도 실패하면 오류를 반환합니다. 숫자 검사는 아라비아 숫자값만 비교하므로 영어로 쓴 수량, 단위, 감정 등 의미 전체를 검증하지는 못합니다.
검증된 영어 초안은 카드 단계에서 변경하지 않습니다. 한국어 연습 팁은 수준별로 미리 작성한 안내이며 나머지 카드 내용은 LLM이 생성합니다.
입력·결과는 영구 저장되지 않습니다. 공식 채점이나 등급 보장 기능은 아니며 결과의 사실 확인이 필요합니다.
인증 없는 로컬 학습용이므로 서버를 인터넷에 공개하지 마세요.

## 개발 검증

```sh
python -m unittest backend.test_core
npx tsc --noEmit
npm run build
```

학습 기준 참고: [국내 OPIc](https://www.opic.or.kr/opics/servlet/controller.opic.site.about.AboutServlet?p_process=move-introduce-opic) · [ACTFL](https://www.actfl.org/assessments/postsecondary-assessments/opi/tips-for-opi-and-opic-test-takers)

표현 지침 참고: [ACTFL 2024 Speaking](https://www.actfl.org/uploads/files/general/Resources-Publications/ACTFL_Proficiency_Guidelines_2024.pdf) · [British Council 접속사](https://learnenglishteens.britishcouncil.org/comment/74051) · [Cambridge 담화 표지](https://dictionary.cambridge.org/grammar/british-grammar/discourse-markers-so-right). 세 표현 수준과 예시는 자체 학습 설계이며 공식 등급별 모범 답안이 아닙니다.

## 비교하고 직접 말하기

- 결과의 ‘같은 이야기, 세 가지 표현 비교’에서 표현 수준별 초안을 비교합니다. 숫자 검사를 통과한 초안만 표시하며, 선택한 수준을 수정한 경우 수정본을 표시합니다. 비교해도 원래 노트의 표현·키워드는 바뀌지 않습니다.
- ‘말하기 연습 시작’에서 전체 답변 → 한국어 뼈대 → 영어 키워드 → 질문만 순서로 연습합니다. 타이머와 단계별 완료 표시는 연습 화면을 떠나면 초기화됩니다. 녹음·음성 인식은 사용하지 않습니다.
- 결과 아래의 보완 질문에 답하면 원문과 추가 답변으로 노트를 다시 생성합니다. 실패하면 기존 노트와 작성한 답변을 유지합니다. 질문은 사실이 아닌 문맥으로 전달하며 원문과 답변의 합계는 1,500자, 추가 답변은 최대 12개입니다. 원문을 수정하면 이전 추가 답변은 초기화됩니다.
- 생성 결과와 추가 답변은 새로고침하면 사라집니다. 필요한 노트는 파일 저장을 이용하세요.
