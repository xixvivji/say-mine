# say.mine

설문과 한국어 경험을 입력하면 내 이야기로 영어 말하기 연습 카드를 만드는 LangChain 기반 OPIc 학습 도우미입니다.
**각자 컴퓨터에서 실행하는 프로젝트**이며, 별도의 공개 웹 서비스는 운영하지 않습니다. 모델은 로컬 Ollama에서 실행하므로 API 키가 필요 없습니다.
현재는 개인 사이드 프로젝트로 웹 앱의 학습 경험을 개선하고 있습니다. 과거 실습 노트북은 보관하며 새 웹 기능과 자동 동기화하지 않습니다.

## 구성

- `web-app/`: 설문·경험 입력 화면, Python API, LangChain 생성 체인
- `notebooks/say-mine_colab.ipynb`: 이전 실습 버전을 보관한 독립 실행 노트북. 최신 웹 기능의 기준은 아닙니다.

표현 수준은 쉬운 독립 문장 / 관계를 연결한 문장 / 세부 정보를 통합한 문장으로 구분합니다.
LLM으로 세 수준의 영어 초안을 생성하고 선택한 초안으로 연습 질문·한국어 뼈대·표현·키워드를 만듭니다.
유효한 경험이 25자 미만이면 모델 호출 없이 보완 질문을 반환합니다.

결과 화면에서 세 표현 수준을 비교하고, 대본을 단계적으로 가리며 말하기를 연습합니다.
새 사실을 더하는 **정보 추가**와 잘못된 사실을 교체하는 **기존 내용 정정**을 구분합니다.
TXT는 읽기용, JSON은 설문·노트·이전 기록의 파일 백업용입니다.
**브라우저 자동 저장**을 켜면 작성 중인 설문·경험과 생성된 노트를 같은 브라우저·주소에서 이어갈 수 있습니다. 기본은 꺼짐이며 저장 데이터는 서버에 전송하지 않습니다. 작성 중인 보완 답변·정정문과 타이머는 저장 대상이 아닙니다.
**학습 기록 보관함**에서 주제·내용·즐겨찾기로 기록을 찾고 저장된 답변으로 바로 복습합니다. 현재 작성 내용은 유지하며 복습에는 LLM을 다시 호출하지 않습니다. 현재 노트와 이전 10개까지 보관하고, 한도를 넘으면 즐겨찾기가 아닌 오래된 이전 기록부터 정리합니다.

## 로컬 실행

먼저 Git, Python 3.12, Node.js 22.13 이상, [Ollama](https://ollama.com/download)를 설치하세요.
Ollama 앱을 실행하거나 별도 터미널에서 `ollama serve`를 실행해 둡니다. 모델 최초 다운로드에는 인터넷과 여유 저장 공간이 필요합니다.

### 1. 내려받기

```sh
git clone https://github.com/xixvivji/say-mine.git
cd say-mine/web-app
```

### 2. 설치

macOS / Linux:

```sh
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
```

Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
```

공통:

```sh
npm ci
ollama pull qwen3:4b-instruct
```

### 3. Python 서버 실행

`web-app` 폴더에서 실행합니다. macOS / Linux에서는 위 가상환경을 활성화한 터미널을 사용하세요.

```sh
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Windows PowerShell에서는 다음 명령을 사용합니다.

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 4. 웹 화면 실행

새 터미널을 열어 같은 `say-mine/web-app` 폴더로 이동한 후 실행합니다.

```sh
npm run dev -- --hostname 127.0.0.1
```

[http://127.0.0.1:5173/](http://127.0.0.1:5173/)에 접속하고 상단의 `AI 연결됨`을 확인하세요.
기본 설정은 `.env` 없이 실행됩니다. 종료할 때는 각 서버 터미널에서 `Ctrl+C`를 누릅니다.

## 보관된 실습 노트북

[Colab에서 노트북 열기](https://colab.research.google.com/github/xixvivji/say-mine/blob/main/notebooks/say-mine_colab.ipynb)

Python 3 · GPU 런타임을 선택하고 위에서부터 실행합니다. 준비 셀이 Ollama와 모델을 설치합니다.
저장된 결과는 로컬 Qwen의 실제 실행 결과이며, 이 수정본의 Colab GPU 전체 실행은 별도 확인이 필요합니다.

## 알아둘 점

- 첫 생성과 모델 로딩은 느릴 수 있습니다. 경험·묘사는 기본 2회(숫자·요일/카드 수정 포함 최대 4회), 롤플레이는 수준별 분리 생성으로 기본 4회(최대 6회) 모델을 호출합니다. 컴퓨터 성능에 따라 속도가 달라집니다.
- `모델 설치 필요`면 모델 이름과 다운로드를, `Ollama 실행 필요`면 Ollama 실행 상태를 확인하세요. 화면에서 연결을 확인할 수 없다면 Python 서버도 확인하세요.
- 포트가 이미 사용 중이라면 해당 포트를 사용하는 프로그램을 확인하거나 실행 포트를 조정하세요. 백엔드 포트를 바꿀 때는 `OPIC_BACKEND_URL`도 맞춰야 합니다.
- 사실성·문법·등급을 보장하지 않습니다. 숫자 검사는 일부 형식만 확인하며 의미 전체를 검증하지 못합니다. 답변을 원문과 비교하고 본인의 말로 다시 연습하세요.
- 공식 OPIc 서비스나 기출·채점 도구가 아닙니다. 인증 없는 로컬 학습용이므로 서버나 Ollama 포트를 인터넷에 공개하지 마세요.
- 모델·가상환경·설치된 패키지·개인 환경 파일은 저장소에 포함하지 않습니다.

체인 구성과 검증 명령은 [웹 실행본 안내](web-app/README.md)를 참고하세요.

브라우저 저장은 기기 간 동기화나 영구 백업이 아닙니다. 브라우저 데이터를 지우면 사라지며, `localhost`와 `127.0.0.1` 또는 다른 포트는 별도 저장 공간입니다. 중요한 기록은 JSON으로 따로 보관하세요.
