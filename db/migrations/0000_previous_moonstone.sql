CREATE TABLE "goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"response_token" text NOT NULL,
	"title" text NOT NULL,
	"cat_id" smallint NOT NULL,
	"window_size" smallint DEFAULT 3 NOT NULL,
	"next_window_size" smallint,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_response_token_unique" UNIQUE("response_token"),
	CONSTRAINT "goal_window_size_range" CHECK ("goal"."window_size" between 3 and 30),
	CONSTRAINT "goal_next_window_size_range" CHECK ("goal"."next_window_size" is null or "goal"."next_window_size" between 3 and 30)
);
--> statement-breakpoint
CREATE TABLE "owner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"window_index" smallint NOT NULL,
	"from_seq" integer NOT NULL,
	"to_seq" integer NOT NULL,
	"window_size" smallint NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_goal_window" UNIQUE("goal_id","window_index"),
	CONSTRAINT "report_seq_order" CHECK ("report"."from_seq" <= "report"."to_seq")
);
--> statement-breakpoint
CREATE TABLE "response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "response_goal_seq" UNIQUE("goal_id","seq"),
	CONSTRAINT "response_body_length" CHECK (char_length("response"."body") between 10 and 1000)
);
--> statement-breakpoint
CREATE TABLE "submission_guard" (
	"goal_id" uuid NOT NULL,
	"browser_hash" text NOT NULL,
	CONSTRAINT "submission_guard_goal_id_browser_hash_pk" PRIMARY KEY("goal_id","browser_hash")
);
--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response" ADD CONSTRAINT "response_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_guard" ADD CONSTRAINT "submission_guard_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goal"("id") ON DELETE cascade ON UPDATE no action;