import { Shield, Zap, EyeOff, Globe } from "lucide-react";

export function WhyPDFNinja() {
    const reasons = [
        {
            title: "100% Private & Secure",
            description: "Everything happens in your browser. Files never touch our servers. Zero risk of data leaks.",
            icon: <Shield className="w-10 h-10 text-emerald-500" />
        },
        {
            title: "Lightning Fast",
            description: "No uploading or downloading delays. Processing is done instantly using your device's power.",
            icon: <Zap className="w-10 h-10 text-yellow-500" />
        },
        {
            title: "No Signups or Limits",
            description: "We don't force you to create an account. Use our tools freely without arbitrary paywalls today.",
            icon: <EyeOff className="w-10 h-10 text-indigo-500" />
        },
        {
            title: "Works Offline-ish",
            description: "Once the site loads, you don't even need an active internet connection to compress or convert.",
            icon: <Globe className="w-10 h-10 text-cyan-500" />
        }
    ];

    return (
        <section className="w-full py-20 bg-muted/20">
            <div className="container mx-auto px-4 sm:px-8 max-w-7xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">Why Choose AI Pdf?</h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Unlike other tools, we prioritize your speed and privacy.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {reasons.map((reason, index) => (
                        <div key={index} className="flex flex-col items-center text-center p-6 bg-card rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                            <div className="bg-background rounded-full p-4 mb-6 ring-1 ring-border shadow-sm">
                                {reason.icon}
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-3">{reason.title}</h3>
                            <p className="text-muted-foreground text-sm">{reason.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
