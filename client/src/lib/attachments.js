import api from './api';

export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.md', '.hwp', '.hwpx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.zip', '.7z',
]);

export const getAttachmentExtension = (filename = '') => {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
};

export const validateAttachmentFile = (file) => {
  const ext = getAttachmentExtension(file?.name || '');
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
    return '문서, 이미지, 압축 파일만 업로드할 수 있습니다.';
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return '첨부파일은 20MB 이하만 업로드할 수 있습니다.';
  }
  if (file.size <= 0) {
    return '빈 파일은 업로드할 수 없습니다.';
  }
  return null;
};

// 인증 헤더가 자동 동봉되는 axios로 첨부파일을 blob으로 받아 다운로드 트리거.
// 실패 시 axios가 reject — 호출처에서 catch하고 사용자에게 알림.
export const downloadAttachment = async (submissionId, attachment) => {
  const res = await api.get(
    `/task-submissions/${submissionId}/attachments/${attachment.stored_name}`,
    { responseType: 'blob' },
  );
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', attachment.filename || attachment.stored_name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};
