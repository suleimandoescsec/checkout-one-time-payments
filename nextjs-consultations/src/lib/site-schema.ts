export const suleimanId = "https://suleimanalnsour.me/#suleiman";
export const saifId = "https://saifjamal.tech/#person";
export const instantReplyId = "https://www.instantreply.co/#organization";

export const instantReplyEntity = {
  "@type": "Organization",
  "@id": instantReplyId,
  name: "InstantReply",
  url: "https://www.instantreply.co/",
  description: "An AI sales agent for Instagram, WhatsApp and Messenger DMs, comments and follow-ups.",
  founder: [{ "@id": suleimanId }, { "@id": saifId }],
};

export const founderGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": suleimanId,
      name: "Suleiman Alnsour",
      url: "https://suleimanalnsour.me/",
      image: "https://suleimanalnsour.me/suleiman-alnsour.png",
      email: "suleiman@instantreply.co",
      jobTitle: "Co-founder of InstantReply",
      description: "Suleiman Alnsour is an InstantReply co-founder based in Dubai, working on AI sales automation, business and marketing.",
      worksFor: { "@id": instantReplyId },
      sameAs: ["https://www.linkedin.com/in/suleimanalnsour"],
      knowsAbout: ["AI sales automation", "Business development", "Marketing", "Building apps with AI"],
    },
    {
      "@type": "Person",
      "@id": saifId,
      name: "Saif Jamal",
      url: "https://saifjamal.tech/",
      jobTitle: "AI engineer and InstantReply co-founder",
      worksFor: { "@id": instantReplyId },
      sameAs: ["https://www.linkedin.com/in/saif-farroukh-242a23348"],
    },
    instantReplyEntity,
    {
      "@type": "Organization",
      "@id": "https://saasmarketing.app/#organization",
      name: "SaaSMarketing.app",
      url: "https://saasmarketing.app",
      founder: { "@id": suleimanId },
      description: "Software for SaaS positioning, campaigns and launch assets.",
    },
    {
      "@type": "WebSite",
      "@id": "https://suleimanalnsour.me/#website",
      name: "Suleiman Alnsour",
      url: "https://suleimanalnsour.me/",
      publisher: { "@id": suleimanId },
      inLanguage: ["en", "ar"],
    },
  ],
};
