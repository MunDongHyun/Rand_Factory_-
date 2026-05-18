import api from './api';

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
