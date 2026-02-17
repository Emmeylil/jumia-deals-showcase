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
                <div className="w-full h-full bg-gray-100 flex items-center justify-center p-4">
                    {/* Grey placeholder as requested */}
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
