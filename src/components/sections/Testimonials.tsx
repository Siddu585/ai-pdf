import { Star } from "lucide-react";

export function Testimonials() {
    const reviews = [
        {
            name: "Priya S.",
            role: "UPSC Aspirant",
            content: "The Exam Photo Resizer is a lifesaver. I needed a 50KB image for my application form and every other site either ruined the quality or made me create an account. Done here in 5 seconds.",
            rating: 5
        },
        {
            name: "Rahul M.",
            role: "Freelance Designer",
            content: "I use the PDF Compressor daily before sending portfolios to clients. The fact that it runs locally in my browser without uploading my confidential designs is huge. Super fast.",
            rating: 5
        },
        {
            name: "Anjali D.",
            role: "HR Manager",
            content: "Merging applicant resumes used to take me forever. Now I just drop 20 PDFs here and it merges them instantly. Best tool I've found, and the interface doesn't feel like spam.",
            rating: 4
        }
    ];

    return (
        <section className="w-full py-24 bg-card border-y border-border">
            <div className="container mx-auto px-4 sm:px-8 max-w-6xl">

                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">Loved by 500,000+ Users</h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        See how students and professionals are saving time with our free utilities.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {reviews.map((review, i) => (
                        <div key={i} className="bg-background rounded-2xl p-8 shadow-sm border border-border flex flex-col">
                            <div className="flex gap-1 mb-6">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className={`w-5 h-5 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted"}`}
                                    />
                                ))}
                            </div>
                            <p className="text-foreground italic mb-8 flex-1 leading-relaxed">
                                &quot;{review.content}&quot;
                            </p>
                            <div className="flex items-center gap-4 mt-auto border-t border-border pt-6">
                                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center font-bold text-secondary">
                                    {review.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground text-sm">{review.name}</h4>
                                    <p className="text-xs text-muted-foreground">{review.role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
}
