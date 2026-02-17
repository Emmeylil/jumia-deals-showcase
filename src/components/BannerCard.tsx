import { addUTMParameters } from "@/lib/utils";
import { Megaphone } from "lucide-react";

interface BannerCardProps {
    image?: string;
    url?: string;
}

const BannerCard = ({ image, url }: BannerCardProps) => {
    const content = (
        <div className="relative bg-white rounded-[1.5rem] shadow-sm flex items-center justify-center h-full overflow-hidden transition-all hover:shadow-md cursor-pointer group border border-dashed border-gray-200">
            {image ? (
                <img
                    src={image}
                    alt="Promotion Banner"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
            ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-gray-400 p-4">
                    <div className="bg-gray-50 p-3 rounded-full group-hover:bg-jumia-purple/10 group-hover:text-jumia-purple transition-colors">
                        <Megaphone size={32} strokeWidth={1.5} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Ad Banner Slot</span>
                </div>
            )}
        </div>
    );

    if (url) {
        return (
            <a
                href={addUTMParameters(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full"
            >
                {content}
            </a>
        );
    }

    return content;
};

export default BannerCard;
