export function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ok<T>(data: T) {
  return {
    data,
    requestId: requestId(),
  };
}

export function page<T>(data: T[], pageNo: number, pageSize: number, total: number) {
  return {
    data,
    page: {
      pageNo,
      pageSize,
      total,
    },
    requestId: requestId(),
  };
}
