// 채번(시퀀스 번호) 공통 유틸

/**
 * 마지막 채번 값에서 다음 시퀀스 번호를 생성한다.
 * 형식: `${prefix}${seq.padStart(padLength, "0")}`
 *
 * @param prefix 채번 prefix (예: "EC-20260102-")
 * @param lastValue 마지막 채번 값 (없으면 null)
 * @param padLength 시퀀스 패딩 길이 (기본 3)
 */
export function nextSequenceNumber(
  prefix: string,
  lastValue: string | null | undefined,
  padLength = 3,
): string {
  let seq = 1;
  if (lastValue) {
    const lastSeq = parseInt(lastValue.split("-").pop() || "0", 10);
    seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(padLength, "0")}`;
}

/**
 * Date 객체를 YYYYMMDD 형식으로 변환 (UTC 기준)
 */
export function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}
