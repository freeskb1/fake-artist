import { TopicCard } from "@/types/game";

export const TOPIC_POOL: TopicCard[] = [
  { cat: "동물", subjects: ["사자", "기린", "펭귄", "문어", "고슴도치", "박쥐", "코끼리", "다람쥐"] },
  { cat: "과일", subjects: ["수박", "바나나", "포도", "파인애플", "석류", "복숭아", "체리", "딸기"] },
  { cat: "음식", subjects: ["피자", "햄버거", "김밥", "라면", "초밥", "떡볶이", "치킨", "만두"] },
  { cat: "탈것", subjects: ["자동차", "자전거", "비행기", "헬리콥터", "잠수함", "기차", "오토바이", "요트"] },
  { cat: "직업", subjects: ["의사", "요리사", "경찰관", "우주비행사", "농부", "소방관", "화가", "목수"] },
  { cat: "운동", subjects: ["축구", "야구", "농구", "스키", "양궁", "펜싱", "수영", "테니스"] },
  { cat: "악기", subjects: ["피아노", "기타", "드럼", "바이올린", "하프", "아코디언", "트럼펫", "색소폰"] },
  { cat: "건물/장소", subjects: ["에펠탑", "피라미드", "성", "등대", "관람차", "풍차", "분수대", "다리"] },
  { cat: "자연", subjects: ["화산", "무지개", "폭포", "섬", "동굴", "오로라", "번개", "회오리"] },
  { cat: "캐릭터", subjects: ["좀비", "유령", "외계인", "인어", "산타", "마법사", "해적", "로봇"] },
  { cat: "빨간 것", subjects: ["토마토", "소방차", "딸기", "장미", "립스틱", "우체통", "고추", "산타옷"] },
  { cat: "둥근 것", subjects: ["축구공", "시계", "도넛", "CD", "타이어", "동전", "반지", "보름달"] },
  { cat: "한국적인 것", subjects: ["한복", "김치", "태극기", "경복궁", "장구", "호랑이", "부채", "북"] },
  { cat: "채소", subjects: ["당근", "양배추", "옥수수", "고추", "브로콜리", "가지", "오이", "버섯"] },
  { cat: "음료", subjects: ["커피", "맥주", "우유", "칵테일", "버블티", "와인", "녹차", "콜라"] },
];

export function pickRandomTopic(): { cat: string; subject: string } {
  const card = TOPIC_POOL[Math.floor(Math.random() * TOPIC_POOL.length)];
  const subject = card.subjects[Math.floor(Math.random() * card.subjects.length)];
  return { cat: card.cat, subject };
}
