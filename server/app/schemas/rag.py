from pydantic import BaseModel, Field


class RagQuery(BaseModel):
    question: str
    k: int = Field(4, ge=1, le=10)


class SourceArticle(BaseModel):
    article_id: int
    title: str


class RagResponse(BaseModel):
    answer: str
    sources: list[SourceArticle]
