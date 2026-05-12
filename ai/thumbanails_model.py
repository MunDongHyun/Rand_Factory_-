import os
import json
import requests
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

# 1. 환경 설정 및 클라이언트 초기화
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

# .env 파일 로드
load_dotenv(PROJECT_DIR / "server" / ".env")
load_dotenv(PROJECT_DIR / ".env", override=False)

openai_api_key = os.getenv("OPENAI_API_KEY")
if openai_api_key:
    os.environ["OPENAI_API_KEY"] = openai_api_key

# 이미지 생성용 클라이언트 초기화
openai_client = OpenAI(api_key=openai_api_key)

# 2. 폴더 경로 설정
summary_dir = BASE_DIR / "summary"
thumbnail_dir = BASE_DIR / "thumbnails"

if not os.path.exists(thumbnail_dir):
    os.makedirs(thumbnail_dir)
    print(f"📁 '{thumbnail_dir}' 폴더가 존재하지 않아 새로 생성했습니다.")

# summary 폴더 안의 모든 JSON 파일 가져오기
json_files = [f for f in os.listdir(summary_dir) if f.endswith('.json')]
print(f"📂 총 {len(json_files)}개의 JSON 요약본을 발견했습니다.")

for idx, file_name in enumerate(json_files[:]):
    file_path = os.path.join(summary_dir, file_name)
    print(f"[{idx+1}/{min(2, len(json_files))}] 썸네일 생성 처리 중: {file_name}")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            result = json.load(f)

        metadata = result.get("metadata", {})
        title = metadata.get("title", "제목 없음")
        theme_analysis = result.get("theme_analysis", "")
        
        card_messages = []
        for card in result.get("card_news", []):
            if "core_message" in card:
                card_messages.append(card["core_message"])
        full_story = " ".join(card_messages)

        article_context = f"제목: {title}\n핵심 요약: {theme_analysis}\n주요 내용: {full_story}"

        print("   🧠 GPT-5.4를 통해 아티클 내용을 상황에 맞는 3D 일러스트 씬으로 기획 중입니다...")
        vision_prompt = f"""
        당신은 비즈니스 아티클의 내용을 매력적이고 스토리텔링이 있는 3D 애니메이션 일러스트로 기획하는 아트 디렉터입니다.
        아래 [아티클 내용]을 읽고, 주제를 가장 잘 나타내는 구체적인 상황(Scene)을 1~2문장의 영어로 묘사하세요.

        [아티클 내용]
        {article_context}

        [작성 규칙]
        1. 상황 중심 연출: 캐릭터들이 주제에 맞는 '구체적인 행동'을 하도록 묘사하세요. (예: 서류를 돋보기로 집중해서 관찰하기, 편안하게 커피를 마시며 자동화된 업무를 지켜보기, 팀원들과 차분하게 의견을 나누기 등)
        2. 자유로운 구성: 인원수나 특정 사물(로봇 등)을 억지로 강제하지 마세요. 아티클 내용에 꼭 필요하고 자연스러운 인물과 소품만 배치하세요.
        3. 텍스트 요소 원천 차단: 장면 묘사 안에 글자(text), 타이포그래피, 복잡한 인포그래픽, 칠판의 글씨 등에 대한 묘사는 절대 포함하지 마세요.
        4. 추가로 표현 방식은 만화적 연출로 사용자가 편하게 볼수 있는 이미지가 될수 있게하세요.
        5. 오직 영어 프롬프트만 출력하세요.
        """

        vision_response = openai_client.chat.completions.create(
            model="gpt-5.4", # 요청하신 대로 gpt-5.4 버전 유지
            messages=[{"role": "user", "content": vision_prompt}],
            temperature=0.7
        )

        visual_description = vision_response.choices[0].message.content.strip()
        print(f"   💡 기획된 씬(Scene) 묘사: {visual_description}")
        print("   🎨 위 장면을 바탕으로 DALL-E 3 썸네일을 생성합니다...")

        image_prompt = (
            f"A high-quality, expressive 3D Disney/Pixar style illustration. Warm and cinematic lighting, engaging composition. "
            f"Scene: {visual_description} "
            f"CRITICAL RULES: DO NOT generate any text, words, letters, or typography anywhere in the image. NO messy infographic overlays. "
            f"Keep the composition clean, focused on the characters and their actions within a cohesive, thematic background."
        )

        # 이미지 생성 API 호출
        image_response = openai_client.images.generate(
            model="dall-e-3",
            prompt=image_prompt,
            size="1024x1024",
            quality="standard", 
            n=1,
        )
        image_url = image_response.data[0].url
        
        # 이미지 다운로드
        img_data = requests.get(image_url).content
        img_file_name = file_name.replace(".json", ".png")
        img_save_path = os.path.join(thumbnail_dir, img_file_name)
        
        with open(img_save_path, 'wb') as img_file:
            img_file.write(img_data)
        
        print(f"   🖼️ 썸네일 저장 완료: {img_save_path}")

        # JSON에 썸네일 경로 추가 및 덮어쓰기
        if "metadata" not in result:
            result["metadata"] = {}
        result["metadata"]["thumbnail_path"] = f"/static/thumbnails/{img_file_name}"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=4)
            
        print("   ✅ 요약 데이터(JSON)에 썸네일 경로 업데이트 완료")

    except Exception as e:
        print(f"   ❌ {file_name} 썸네일 처리 중 오류 발생: {e}")

print("\n✨ 썸네일 생성 작업이 완료되었습니다!")