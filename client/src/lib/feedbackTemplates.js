// 매니저 피드백 작성 시 한 클릭으로 textarea에 이어붙이는 빠른 코멘트.
export const FEEDBACK_QUICK_COMMENTS = [
  '수고하셨습니다 :)',
  '좋은 시도예요. 다음 부분을 더 보완해 주세요.',
  '이 부분을 다시 정리해 주시면 좋겠어요.',
  '관련 아티클을 참고해 보완해 주세요.',
];

export const appendQuickComment = (current, comment) => {
  const base = (current || '').trimEnd();
  return base ? `${base}\n${comment}` : comment;
};
