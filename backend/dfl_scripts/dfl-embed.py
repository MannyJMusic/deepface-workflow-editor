import argparse
import json
import os
import sys

from DFLJPG import DFLJPG

# fix for local importing
file_dir = os.path.dirname(__file__)
sys.path.append(file_dir)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("image_path")
    parser.add_argument("--payload")

    try:
        args = parser.parse_args()
        payload_no_slash = args.payload.replace('\\"', '"') # linux deserialization fix
        face_data = json.loads(payload_no_slash)

        # check for custom
        DFLJPG.embed_data(args.image_path,
            face_type=face_data['face_type'],
            source_filename=face_data['source_filename'],
            source_landmarks=face_data['source_landmarks'],
            landmarks=face_data['landmarks'],
            source_rect=face_data['source_rect'],
            image_to_face_mat=face_data['image_to_face_mat']
        )
    except Exception as e:
        sys.stdout.write(str(e) + '\n')
        sys.stdout.write('error' + '\n')
        exit(-1)


    sys.stdout.write('done')
