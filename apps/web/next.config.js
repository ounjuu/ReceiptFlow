/** @type {import('next').NextConfig} */
const nextConfig = {
  // workspace 패키지(@ledgerflow/shared)의 ts 파일을 Next가 transpile
  transpilePackages: ["@ledgerflow/shared"],
};

module.exports = nextConfig;
