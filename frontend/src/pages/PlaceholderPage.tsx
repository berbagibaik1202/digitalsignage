import { type LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
}

export default function PlaceholderPage({ title, description, icon: Icon }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="text-gray-400 mt-1">{description}</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <Icon className="w-12 h-12 text-gray-600 mb-4" />
        <p className="text-gray-400">Coming soon</p>
      </div>
    </div>
  );
}
