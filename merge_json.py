import os
import json

# Correct path to Data/plans
plans_dir = "Data/plans"
output_file = "Data/merged_plans.json"

all_plans = []

for filename in os.listdir(plans_dir):
    if filename.endswith(".json"):
        filepath = os.path.join(plans_dir, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                plan_data = json.load(f)
                all_plans.append(plan_data)
        except json.JSONDecodeError as e:
            print(f"❌ Error in {filename}: {e}")

# Write to merged file
with open(output_file, "w", encoding="utf-8") as out:
    json.dump(all_plans, out, indent=2)

print(f"✅ Merged {len(all_plans)} files into {output_file}")
