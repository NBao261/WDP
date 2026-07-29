import { Loading } from './ui/Loading';

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = 'Đang tải dữ liệu...' }: PageLoaderProps) {
  return <Loading text={message} variant="container" />;
}
