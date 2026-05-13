// 페이지 상단 제목 (공용 컴포넌트)
// 각 페이지 module.css의 .title 패턴이 거의 동일하게 반복되어 추출.
// 추후 페이지에서 <PageTitle>제목</PageTitle> 형태로 사용.

import type { ReactNode } from "react";
import styles from "./PageTitle.module.css";

interface PageTitleProps {
  children: ReactNode;
}

export function PageTitle({ children }: PageTitleProps) {
  return <h1 className={styles.title}>{children}</h1>;
}
