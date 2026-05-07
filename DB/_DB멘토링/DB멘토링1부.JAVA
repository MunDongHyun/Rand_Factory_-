[20260504:DB멘토링] 김광진

● 객체지향프로그래밍 언어: Java

> 객체란?
. 세상에 존재하는 유무형의 모든 것
. 사람/동물/사물/장소/공연/상품/예약/주문/배송/후기/느낌/감정 등의 개념적 정의.

(1) 고유한 속성
(2) 타인도 알 수 있는 것
(3) 사전에 등록된 단어

 A : "우리 오늘 점심 때 라면 먹을래?"
 B : "응, 그래 좋아"

              라면 --> 객체(O)
     "오뚜기진라면"  --> 객체가 구현된 실체(인스턴스:instance)
------------------------------------------------------------------------------------
* 객체의 '고유한 속성'을 Java에서 어떻게 나타내지?

  - Primitive Type

  -정수형(4)
  . byte     ...  8 bit(작은수), 2^8=256, (-128~-1, 0~127)
  . short    ... 16 bit(큰수)
  . int      ... 32 bit(더큰수)
  . long     ... 64 bit(더더큰수)

  -실수형(2)
  . float    ... 32 bit
  . double   ... 64 bit
  
  -문자형(1)
  . char     ... 16 bit 유니코드(각 나라의 글자를 모아놓은 캐릭터 테이블)

  -불린형(1)
  . boolean  ...  1 bit(true:1, false:0)

  * 비트(bit, binary digit): 컴퓨터에서 데이터를 표현하고 처리하기 위한 최소 단위(0, 1)
------------------------------------------------------------------------------------
* '속성+기능'이 포함된 복합적인 형태의 객체는 Java에서 어떻게 나타내지?__정답: 클래스

   (1) 사용자 정의 클래스(user-defined class) : Student.java 
   (2) 내장 클래스(built-in class) : ArrayList / String / Integer / Double / Random / Date / Calendar etc

  학생(😊) : 이름/나이/학과  +  출석하다()/공부하다()/시험보다()
            -------------    ----------------------------
                (속성)                 (기능)

  public class Student {                       // 클래스 이름

     private String name;                      // 클래스 속성:멤버필드:Property
     private int age;

     public Student()                          // 생성자 1 > Student s1 = new Student();
     {
     
     }
     
     public Student(String name, int age)      // 생성자 2 > Student s2 = new Student("Tom", 24);
     {
        this.name = name;
        this.age  = age;
     }

     public void setName(String name) {        // 메서드:멤버함수
        this.name = name;
     }
     
     public void getName() {
        return this.name;
     }

     public void setAge(int age) {
        this.age = age;
     }
     
     public int getAge() {
        return this.age;
     }
     
  }  
------------------------------------------------------------------------------------
(0) 객체──┐
(1) 고유 속성 --> Primitive Type (원시타입 8가지)
(2) 속성+기능 --> Reference Type (클래스/추상클래스/인터페이스)   

* 추상클래스(Abstract Class)

  [type]  [subtype]
----------------------------------------
. 구기종목: 축구/농구/배구/탁구
. 가전제품: TV/냉장고/세탁기/전자렌지
. 모양   : 세모/네모/동그라미/마름모
. 색깔   : 빨강/노랑/파랑/초록/보라
.  병    : 술병/물병/약병/꽃병/유리병/플라스틱병
.  쌀    : 밥/떡/죽
----------------------------------------
class C extends A    (O)
class C extends A, B (x) <- Java에서 두 개의 부모클래스를 상속받지 못함:중복상속(X), 파이썬에서 중복상속(O)

* 인터페이스(interface): 객체들 사이에서 자주 발생하는 동작이나 상태를 정의해 놓은 것.

  😃 <---> 😃
     .talk 
     .fight 

     USB  <--> USB 
     HDMI <--> HDMI 
     DP   <--> DP 
     RJ45 <--> RJ45

  public interface Human {
      public void talk();   // 구현부가 없는 함수=추상메서드=불완전체!
      public void fight();
  }   

  public class Boy implements Human {

     @Override // 재정의, '@': annotation, an(before) + notation 언급)
     public void talk()
     {
        System.out.println("Boy is talking...");
     }

     @Override
     public void fight()
     {
        System.out.println("Boy is fighting...");
     }
  }

  public void talk() // 함수 선언부(head)
  {
    ....;            // 함수 구현부(body)
  }



















  public interface ITV {
      public void on();
      public void off();
      public void switchChannel(int channel);
  }
------------------------------------------------------------------------------------
* Reference Type(참조타입)이란? 클래스/추상클래스/인터페이스 등등

학생 -> Student.java -> Student.class -> JVM(Java Virtual Machine) -> Java runtime data area 

     [1]            [2]            [3]            [4]             [5]
(Method Area)...(Stack Area)...(Heap Area)...(PC Register)...(Native Method Stack)




int a = 10;                  // 로컬변수 a에 값 10이 할당됨.
Student s1 = new Student();  // 참조변수 s1은 인스턴스-Student()를 할당받음.

(Stack Area).......................(Heap Area)
로컬/매개/참조변수 저장                  인스턴스 저장

a = 10;                             Student() <<< [0x0002309421303def]
s1 = [0x0002309421303def]..........................▲                         


'참조변수 s1은 자신에게 할당된 인스턴스-Student()를 어떻게 참조하는가?'
'참조변수 s1은 힙 영역에서 인스턴스가 할당받은 메모리 주소를 이용해서 참조한다.'
'참조변수란 힙 영역의 인스턴스 메모리 주소다!'
------------------------------------------------------------------------------------
* 인스턴스(instance):  객체를 토대로 생성한 실체

  Student s1 = new Student();    (O)
  Human   h1 = new Human();      (X)
  Boy     h1 = new Boy();        (O)
  Human   h2 = new Boy();        (O)

  ex) List list = new ArrayList(); // ArrayList() 구현체는 List 인터페이스를 구현한 것.

------------------------------------------------------------------------------------
* 인스턴스가 여러 개 생성된 경우

  Student s1 = new Student("Mike",   28);
  Student s2 = new Student("Jack",   25);
  Student s3 = new Student("Bill",   24);
  Student s4 = new Student("John",   26);
  Student s5 = new Student("Steve",  28);

  ArrayList<Student> list = new ArrayList<Student>();

  list.add(s1);
  list.add(s2);
  list.add(s3);
  list.add(s4);
  list.add(s5);

  list = {s1, s2, s3, s4, s5}

  for (int i = 0; i < list.size(); i++) {
    Student s = list.get(i);
    System.out.println(s.getName());
  }

  for (Student s : list)
  {
    System.out.println(s.getName());
  }
------------------------------------------------------------------------------------
* ArrayList 사용 시 주의사항 3가지

 i) 타입<T>가 생략된 경우, 기본타입으로 <Object>가 세팅됨. 
 
   ArrayList list = new ArrayList();
   list.add("a");         
   // "a"가 문자열이 아니라 Object로 저장됨.
   String s  = (Object) list.get(0); (x)
   String s  = (String) list.get(0); (O) 
   // 타입을 사전에 지정하지 않은 경우, 개발자가 타입을 변경해줘야하는 수고로움이 생긴다 >> 형변환(Type Casting)

 ii) ArrayList<String> list = new ArrayList<>(); 
 // 이게 인정됨? 네! 왜죠? >> 타입추론(Type Inference)이 인정되고 있음.

iii) int같은 primitive type은 타입<T>으로 사용할 수 없음(원칙!)
 
    (x) ArrayList<int> list = new ArrayList<int>();
    (O) ArrayList<Integer> list = new ArrayList<Integer>();
        list.add(new Integer(a));       // boxing
        list.add(a);                    // autoboxing
        
        (0) 객체(Object) ─────────┐
        (1) 고유 속성 --> Primitive Type (원시타입 8가지)             <== 객체(x)
        (2) 속성+기능 --> Reference Type (클래스/추상클래스/인터페이스)  <== 제대로 된 객체(o)  
 
   
        int .... Integer 

        int a = 10;

        Integer num1 = new Integer(a);   // boxing 
        int     num2 = num1.intValue();  // unboxing
        Integer num3 = a;                // autoboxing
        int     num4 = num3;             // autounboxing
------------------------------------------------------------------------------------
- Primitive Type : byte, short, int, long, float, double, char, boolean


 [Wrapper Class] : Primitive Type --> Reference Type으로 바꿔주는 클래스
------------------------------------------------------------------------------------
         초기 타입(8) ──  참조형 클래스(8)
             ▽            ▽           
            byte    ...  Byte
            short   ...  Short
            int     ...  Integer   *
            long    ...  Long
            float   ...  Float
            double  ...  Double
            char    ...  Character
            boolean ...  Boolean 
------------------------------------------------------------------------------------  
* 자바의 5대 핵심 기능: 캡슐화 / 상속 / 다형성 / 구현 / 직렬화

1) 캡슐화(encapsulation): 속성이나 기능을 넣어서 클래스/추상클래스/인터페이스를 만드는 것.
    en(=make) + capsule(?) + tion(명사형어미)

    가루약 --------------> 캡슐
   (속성/기능)         (클래스/추상클래스/인터페이스)


2) 상속(inheritance): 부모클래스의 속성과 기능을 자식클래스가 물려 받는 것

3) 다형성(polymorphism): 라틴어(multi)=그리이스어(poly)=영어(many)=여러개 + morph(형태, form)
   3.1) 서브타입 다형성(subtype polymorphism)
   3.2) 매개변수 다형성(parametric polymorphism): 생성자 오버로딩 등

4) 구현(implementation): 인터페이스에 있는 추상 메서드를 구현클래스가 초기화해주는 것

5) 직렬화(serialization): 네트워크나 파일 생성 시에 전송 효율성을 높이기 위해서 데이터를 바이트 코드(byte code:스트림) 형태로 바꿔서 한줄로 세움.


     (1)                                    (2)
      ▩                                     ▩
      ▩        '   '    '   '               ▩
      ▩     '  '   '   '   '  '  '  '       ▩
      ▩    '  '  '  '  '  '  '  '  '  '     ▩
      ▩   '  '  '  '  '  '  '  '   '  '     ▩
    <--- '  '   '   '  '  '  '  '  '  '   <---  ' ' ' ' ' ' ' ' ' ' ' ' ' ' ' ' ' ' ' 
      ▩     '  '  '  '  '  '  '  '  '       ▩          (Serialization, 직렬화)
      ▩   '  '  '  '  '  '  '  '  '         ▩
      ▩     '   '   '  '  '  '  '  ''       ▩
      ▩   '   '   '   '   '  '   '  '       ▩
      ▩     '  '  ' '   '  '  '   '         ▩
      ▩         '  '  '  '  '  '            ▩
     (1)                                    (2)
------------------------------------------------------------------------------------
* 근데, 인스턴스 개수가 엄청나게 많아지면 어떡할래?__정답: 데이터베이스

  Student s000001 = new Student("Tomson", 28);
  Student s000002 = new Student("Jack",   25);
  Student s000003 = new Student("Bill",   24);
          .......
  Student s469999 = new Student("Robert", 32);
  Student s470000 = new Student("John",   35);

  회원관리 = {회원1, 회원2, 회원3, 회원4, 회원5, ... } 
           ------------------------------------
                인스턴스 집합=Entity(엔터티)

  회원관리 :    MEMBER_INFO | MEMBERS | T_MEMBER | TB_MEMBER | TBL_MEMBER
  ------------------------------------------------------------------------------------
  회원 아이디   MB_ID VARCHAR2(20) NOT NULL
  회원 비밀번호 MB_PW VARCHAR2(20) NOT NULL
  회원 이름    MB_NAME VARCHAR2(40) NOT NULL 
  회원 이메일  MB_EMAIL VARCHAR2(50) NOT NULL
  ------------------------------------------------------------------------------------  
  CREATE TABLE MEMBERS (
    MB_ID VARCHAR2(20) NOT NULL,
    MB_PW VARCHAR2(20) NOT NULL,
    MB_NAME VARCHAR2(40) NOT NULL, 
    MB_EMAIL VARCHAR2(50) NOT NULL,
    PRIMARY KEY (MB_ID)
  );    

  CREATE TABLE IF NOT EXISTS T2 (
    ....,
    ....,
    ....
  );  

  # 쌤!, 제가요, 타이핑을 하면서 테이블을 하나씩 만들고 있습니다.
    손가락이 열라~ 아프구요, 너무 힘듭니다. ㅠ.ㅠ
    좀 더 편리한 방법이 업떠요? 이떠요! 그게 모죠? 정답: DB설계툴 !?!? :~()

    (1) https://www.erwin.com      (전세계 시장 1위) <--'네카라쿠배당토직야'
    (2) https://www.erdcloud.com   (웹기반)
    (3) https://www.aquerytool.com (국산허접, but~~~)        

-------------------(제1부, 객체지향프로그래밍 관점에서 살펴본 데이터의 생성과정. 끝)------------------

PostgreSQL/pgvector 환경 구축하기

# Docker 환경을 시작하는 방법[1]

[Docker]                 Container based Virtual Platform
-----------------------
[CentOS/Unbuntu/Kali]    Guest OS
-----------------------
[VMWare/VirtualBox/WSL]  Virtual Platform
-----------------------
[Windows 10]             Host OS


* WSL(Windows Subsystem for Linux) : 리눅스를 위한 윈도우의 하위시스템


# Docker 환경을 시작하는 방법[2]

[Docker]                 Container based Virtual Platform
-----------------------
[VMWare/VirtualBox/WSL]  Virtual Platform
-----------------------
[Windows 10]             Host OS


* WSL(Windows Subsystem for Linux) : 리눅스를 위한 윈도우의 하위시스템


c:>docker volume create vgp 
c:>docker volume ls 

c:>docker run -d \
--name pgvector-container \
-p 5432:5432 \
-e POSTGRES_USER=mdts_user \
-e POSTGRES_PASSWORD=1234 \
-e POSTGRES_DB=mdts_db \
-v vpg:/var/lib/postgresql/data 
ankane/pgvector  엔터!

* docker hub에 있는 이미지들(PostgreSQL)
ankane/pgvector        (pg 15.4)
pgvector/pgvector:pg17 (pg 17)
pgvector/pgvector:pg18 (pg 18)