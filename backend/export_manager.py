"""
Export Manager
자막 내보내기 기능 (SRT, VTT, Premiere Pro XML)

지원 형식:
- SRT (SubRip): 범용 자막 포맷
- VTT (WebVTT): 웹 표준 자막 포맷
- XML (Premiere Pro): Adobe Premiere Pro / Final Cut Pro 7 호환
"""

from typing import List, Dict, Any
import datetime
from jinja2 import Template


class ExportManager:
    """자막 및 프로젝트 내보내기 관리자"""

    @staticmethod
    def format_timestamp_srt(seconds: float) -> str:
        """
        SRT 타임스탬프 포맷으로 변환

        Args:
            seconds: 초 단위 시간

        Returns:
            "00:00:01,500" 형식의 문자열
        """
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)

        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    @staticmethod
    def format_timestamp_vtt(seconds: float) -> str:
        """
        VTT 타임스탬프 포맷으로 변환

        Args:
            seconds: 초 단위 시간

        Returns:
            "00:00:01.500" 형식의 문자열
        """
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)

        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

    @staticmethod
    def format_timestamp_xml(seconds: float, frame_rate: int = 30) -> int:
        """
        XML 타임코드 포맷으로 변환 (프레임 단위)

        Args:
            seconds: 초 단위 시간
            frame_rate: 프레임 레이트 (기본값: 30fps)

        Returns:
            프레임 번호
        """
        return int(seconds * frame_rate)

    def generate_srt(self, captions: List[Dict[str, Any]]) -> str:
        """
        SRT 자막 파일 생성

        Args:
            captions: 자막 데이터 리스트
                [{"start": 0.0, "end": 2.5, "text": "안녕하세요"}, ...]

        Returns:
            SRT 형식의 문자열

        Example:
            1
            00:00:00,000 --> 00:00:02,500
            안녕하세요

            2
            00:00:02,500 --> 00:00:05,000
            반갑습니다
        """
        if not captions:
            return ""

        srt_lines = []

        for idx, caption in enumerate(captions, start=1):
            start_time = self.format_timestamp_srt(caption.get("start", 0))
            end_time = self.format_timestamp_srt(caption.get("end", 0))
            text = caption.get("text", "").strip()

            if not text:
                continue

            # SRT 블록 생성
            srt_lines.append(f"{idx}")
            srt_lines.append(f"{start_time} --> {end_time}")
            srt_lines.append(text)
            srt_lines.append("")  # 빈 줄

        return "\n".join(srt_lines)

    def generate_vtt(self, captions: List[Dict[str, Any]]) -> str:
        """
        VTT(WebVTT) 자막 파일 생성

        Args:
            captions: 자막 데이터 리스트

        Returns:
            VTT 형식의 문자열

        Example:
            WEBVTT

            00:00:00.000 --> 00:00:02.500
            안녕하세요

            00:00:02.500 --> 00:00:05.000
            반갑습니다
        """
        if not captions:
            return "WEBVTT\n\n"

        vtt_lines = ["WEBVTT", ""]

        for caption in captions:
            start_time = self.format_timestamp_vtt(caption.get("start", 0))
            end_time = self.format_timestamp_vtt(caption.get("end", 0))
            text = caption.get("text", "").strip()

            if not text:
                continue

            # VTT 블록 생성
            vtt_lines.append(f"{start_time} --> {end_time}")
            vtt_lines.append(text)
            vtt_lines.append("")  # 빈 줄

        return "\n".join(vtt_lines)

    def generate_premiere_xml(
        self,
        project_name: str,
        video_file_path: str,
        captions: List[Dict[str, Any]],
        frame_rate: int = 30,
        video_width: int = 1920,
        video_height: int = 1080,
        audio_sample_rate: int = 48000,
    ) -> str:
        """
        Adobe Premiere Pro XML 파일 생성 (Final Cut Pro 7 XML 표준)

        Args:
            project_name: 프로젝트 이름
            video_file_path: 비디오 파일 경로 (절대 경로 또는 상대 경로)
            captions: 자막 데이터 리스트
            frame_rate: 프레임 레이트 (기본값: 30fps)
            video_width: 비디오 너비 (기본값: 1920)
            video_height: 비디오 높이 (기본값: 1080)
            audio_sample_rate: 오디오 샘플레이트 (기본값: 48000Hz)

        Returns:
            XML 형식의 문자열
        """

        # 자막을 시퀀스 마커로 변환
        markers = []
        for idx, caption in enumerate(captions):
            start_frame = self.format_timestamp_xml(caption.get("start", 0), frame_rate)
            text = caption.get("text", "").strip()

            if text:
                markers.append({
                    "id": idx + 1,
                    "frame": start_frame,
                    "text": text,
                    "color": "Green",  # Premiere Pro 마커 색상
                })

        # Jinja2 템플릿
        template_str = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
    <project>
        <name>{{ project_name }}</name>
        <children>
            <sequence id="sequence-1">
                <name>{{ project_name }} - Sequence</name>
                <duration>{{ duration }}</duration>
                <rate>
                    <timebase>{{ frame_rate }}</timebase>
                    <ntsc>FALSE</ntsc>
                </rate>
                <timecode>
                    <rate>
                        <timebase>{{ frame_rate }}</timebase>
                        <ntsc>FALSE</ntsc>
                    </rate>
                    <string>00:00:00:00</string>
                    <frame>0</frame>
                    <displayformat>NDF</displayformat>
                </timecode>
                <media>
                    <video>
                        <format>
                            <samplecharacteristics>
                                <rate>
                                    <timebase>{{ frame_rate }}</timebase>
                                    <ntsc>FALSE</ntsc>
                                </rate>
                                <width>{{ video_width }}</width>
                                <height>{{ video_height }}</height>
                                <pixelaspectratio>Square</pixelaspectratio>
                            </samplecharacteristics>
                        </format>
                        <track>
                            <clipitem id="clipitem-1">
                                <name>{{ video_file_name }}</name>
                                <duration>{{ duration }}</duration>
                                <rate>
                                    <timebase>{{ frame_rate }}</timebase>
                                    <ntsc>FALSE</ntsc>
                                </rate>
                                <start>0</start>
                                <end>{{ duration }}</end>
                                <in>0</in>
                                <out>{{ duration }}</out>
                                <file id="file-1">
                                    <name>{{ video_file_name }}</name>
                                    <pathurl>{{ video_file_path }}</pathurl>
                                    <rate>
                                        <timebase>{{ frame_rate }}</timebase>
                                        <ntsc>FALSE</ntsc>
                                    </rate>
                                    <duration>{{ duration }}</duration>
                                    <media>
                                        <video>
                                            <samplecharacteristics>
                                                <rate>
                                                    <timebase>{{ frame_rate }}</timebase>
                                                    <ntsc>FALSE</ntsc>
                                                </rate>
                                                <width>{{ video_width }}</width>
                                                <height>{{ video_height }}</height>
                                            </samplecharacteristics>
                                        </video>
                                        <audio>
                                            <samplecharacteristics>
                                                <depth>16</depth>
                                                <samplerate>{{ audio_sample_rate }}</samplerate>
                                            </samplecharacteristics>
                                        </audio>
                                    </media>
                                </file>
                                {% if markers %}
                                <marker>
                                    {% for marker in markers %}
                                    <sequence id="marker-{{ marker.id }}">
                                        <name>{{ marker.text }}</name>
                                        <comment>{{ marker.text }}</comment>
                                        <in>{{ marker.frame }}</in>
                                        <out>-1</out>
                                    </sequence>
                                    {% endfor %}
                                </marker>
                                {% endif %}
                            </clipitem>
                        </track>
                    </video>
                    <audio>
                        <track>
                            <clipitem id="clipitem-audio-1">
                                <name>{{ video_file_name }}</name>
                                <duration>{{ duration }}</duration>
                                <rate>
                                    <timebase>{{ frame_rate }}</timebase>
                                    <ntsc>FALSE</ntsc>
                                </rate>
                                <start>0</start>
                                <end>{{ duration }}</end>
                                <in>0</in>
                                <out>{{ duration }}</out>
                                <file id="file-1"/>
                            </clipitem>
                        </track>
                    </audio>
                </media>
            </sequence>
        </children>
    </project>
</xmeml>
"""

        # 비디오 길이 계산 (마지막 자막의 end 시간 기준)
        duration_seconds = max([c.get("end", 0) for c in captions]) if captions else 0
        duration_frames = self.format_timestamp_xml(duration_seconds, frame_rate)

        # 파일명 추출
        import os
        video_file_name = os.path.basename(video_file_path)

        # 템플릿 렌더링
        template = Template(template_str)
        xml_content = template.render(
            project_name=project_name,
            video_file_path=video_file_path,
            video_file_name=video_file_name,
            frame_rate=frame_rate,
            video_width=video_width,
            video_height=video_height,
            audio_sample_rate=audio_sample_rate,
            duration=duration_frames,
            markers=markers,
        )

        return xml_content

    def generate_fcpxml(
        self,
        project_name: str,
        video_file_path: str,
        captions: List[Dict[str, Any]],
        frame_rate: int = 30,
    ) -> str:
        """
        Final Cut Pro X XML 파일 생성 (FCPXML 1.9)

        Args:
            project_name: 프로젝트 이름
            video_file_path: 비디오 파일 경로
            captions: 자막 데이터 리스트
            frame_rate: 프레임 레이트

        Returns:
            FCPXML 형식의 문자열
        """

        # FCPX는 rational time을 사용 (분자/분모)
        # 30fps = 1/30s per frame
        frame_duration = f"1/{frame_rate}s"

        # 자막을 마커로 변환
        markers_xml = []
        for idx, caption in enumerate(captions):
            start_seconds = caption.get("start", 0)
            text = caption.get("text", "").strip()

            if text:
                # FCPX 타임코드는 "초/1초" 형식
                markers_xml.append(f"""
                    <marker start="{start_seconds}/1s" duration="{frame_duration}" value="{text}"/>
                """)

        # 비디오 길이
        duration_seconds = max([c.get("end", 0) for c in captions]) if captions else 0

        import os
        video_file_name = os.path.basename(video_file_path)

        fcpxml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
    <resources>
        <format id="r1" name="FFVideoFormat1920x1080p30" frameDuration="{frame_duration}" width="1920" height="1080"/>
        <asset id="r2" name="{video_file_name}" src="file://{video_file_path}" start="0s" duration="{duration_seconds}/1s" hasVideo="1" hasAudio="1">
            <media-rep kind="original-media"/>
        </asset>
    </resources>
    <library>
        <event name="{project_name}">
            <project name="{project_name}">
                <sequence format="r1" duration="{duration_seconds}/1s" tcStart="0s" tcFormat="NDF">
                    <spine>
                        <asset-clip ref="r2" offset="0s" name="{video_file_name}" duration="{duration_seconds}/1s" start="0s">
                            {''.join(markers_xml)}
                        </asset-clip>
                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>
"""
        return fcpxml


# 사용 예시
if __name__ == "__main__":
    # 테스트 데이터
    test_captions = [
        {"start": 0.0, "end": 2.5, "text": "안녕하세요"},
        {"start": 2.5, "end": 5.0, "text": "반갑습니다"},
        {"start": 5.0, "end": 8.0, "text": "오늘은 좋은 날씨네요"},
    ]

    manager = ExportManager()

    # SRT 생성
    print("=== SRT ===")
    srt_content = manager.generate_srt(test_captions)
    print(srt_content)

    # VTT 생성
    print("\n=== VTT ===")
    vtt_content = manager.generate_vtt(test_captions)
    print(vtt_content)

    # Premiere Pro XML 생성
    print("\n=== Premiere Pro XML ===")
    xml_content = manager.generate_premiere_xml(
        project_name="테스트 프로젝트",
        video_file_path="/path/to/video.mp4",
        captions=test_captions,
    )
    print(xml_content[:500])  # 앞부분만 출력
