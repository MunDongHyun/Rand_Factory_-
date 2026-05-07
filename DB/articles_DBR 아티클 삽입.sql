INSERT INTO articles (
	article_id,
    article_source,
    article_title,
    article_author,
    article_published_date,
    article_category,
    article_source_url,
    article_image_count
)
VALUES
    ('1', 'DBR', '사내 교육 받은 근로자는 ‘업무 증강’ AI 자동화 위험 낮추고 임금 올라', '최호진',  '2026-02', 'HRD','https://dbr.donga.com/article/view/1201/article_no/11990/ac/search', 0),
	('2', 'DBR', 'AI 활용한 개인맞춤형 가치 창출', '백상경',  '2026-01', 'AI','https://dbr.donga.com/article/view/1101/article_no/11955/ac/search', 4),
    ('3', 'DBR', 'AI 무기로 초격차 만드는 초고성과자 인력구조 재편 가속, 보상도 양극화 전망', '권기범',  '2025-09', 'AI','https://dbr.donga.com/article/view/1101/article_no/11804/ac/search', 2),
    ('4', 'DBR', '물류 로봇이 데이터 학습해 공정 판단 고정형 자동화 넘어 지능형 자율화로', '장재웅',  '2026-03', 'AI','https://dbr.donga.com/article/view/1101/article_no/12055/ac/search', 6),
    ('5', 'DBR', '"너무 완벽하게 준비하다간 타이밍 놓쳐 실행→수정하는 ‘진화적 완벽주의’ 필요"', '백상경',  '2026-02', '경영','https://dbr.donga.com/article/view/1306/article_no/12016/ac/search', 3),
    ('6', 'DBR', '동원 ‘비욘드 참치’ 리브랜딩 전략', '김윤진',  '2026-04', '마케팅','https://dbr.donga.com/article/view/1901/article_no/12075/ac/search', 9),
    ('7', 'DBR', '이걸요? 제가요? 왜요? ‘3요’ 직원 협업시키려면', '김성완,현미숙',  '2024-02', '리더십', 'https://dbr.donga.com/article/view/1201/article_no/11178/ac/search', 6),
    ('8', 'DBR', '저관여 제품에 특히 효과적인 ‘리테일 미디어’ 구매 직전 소비자에게 노출돼 효과 극대화', '이장혁',  '2026-02', '마케팅','https://dbr.donga.com/article/view/1202/article_no/12017/ac/search', 3),
    ('9', 'DBR', '리더의 ‘공감’이 ‘좋은 사람 되기’가 아닌 이유', '정상민',  '2026-02', '리더십', 'https://dbr.donga.com/article/view/1306/article_no/12019/ac/search', 3),
    ('10', 'DBR', '프롬프트에 담긴 고객 의도 분석해 AI가 답으로 호출할 좌표를 설계하라', '박세용',  '2026-04', 'AI', 'https://dbr.donga.com/article/view/1904/article_no/12077/ac/search', 4),
    ('11', 'DBR', '"ESG 효과, 어떻게 해석되느냐에 달려 실행과 동시에 전략적으로 설명해야"', '백상경',  '2026-04', '경영','https://dbr.donga.com/article/view/120 3/article_no/12078/ac/search', 1),
    ('12', 'DBR', '‘소통 불가’ TF 동료 때문에 속 터져요', '김재은,함규정',  '2026-04', '리더십', 'https://dbr.donga.com/article/view/1201/article_no/12079/ac/search', 5),
    ('13', 'DBR', 'CEO 메시지, 목표 상충하거나 모호해선 안돼 고해상도 언어로 최우선 기준 명확히 해야', '김지은',  '2026-03', '경영', 'https://dbr.donga.com/article/view/1306/article_no/12062/ac/search', 2),
    ('14', 'DBR', '높은 연봉ㆍ좋은 근무 환경보다 중요한 것은?', '김준태',  '2024-03', '경영', 'https://dbr.donga.com/article/view/1303/article_no/11224/ac/search', 1),
    ('15', 'DBR', '"AI 시대 인재는 학습민첩성ㆍ책임의식 절실 정해진 답 없는 문제 해결해 본 경험 중요"', '최호진',  '2026-03', 'HRD', 'https://dbr.donga.com/article/view/1201/article_no/12039/ac/search', 4)
;
    


select * from articles;
delete from articles;

select * from ai_outputs;