import DOMPurify from 'dompurify';

// 학습자/매니저가 입력한 HTML을 화면에 dangerouslySetInnerHTML로 렌더할 때 사용.
// 에디터(jodit/TipTap 등)와 무관하게 모든 사용자 HTML은 이 함수를 거치게 한다.
// - <script>, on* 핸들러, javascript: URL 등 위험 요소 제거
// - 같은 회사 내부 사용 가정이지만 저장형 XSS 방어로 기본 정책 적용
export const sanitizeHtml = (html) => DOMPurify.sanitize(html || '');
